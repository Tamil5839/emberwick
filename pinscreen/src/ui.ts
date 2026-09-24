// DOM chrome: the control panel, keyboard shortcuts, drag-and-drop, the camera
// permission / error card, recording countdown and REC indicator, clean mode,
// toasts and the stats readout.

import GUI, { type Controller } from 'lil-gui';
import type { CameraErrorKind } from './camera';
import { supportedFormats } from './recorder';
import {
  DENSITIES,
  FINISHES,
  FRAMES,
  MAX_DEPTH,
  resetSettings,
  saveSettings,
  settings,
  type SourceName,
} from './settings';

export type RecordingState = 'idle' | 'countdown' | 'recording' | 'saving';

/** Past this, the take is longer than X/Twitter accepts on a standard account. */
const X_LIMIT_SECONDS = 140;
const CURSOR_IDLE_MS = 1500;

export interface UIHandlers {
  onResetView(): void;
  onDensityChange(): void;
  onFinishChange(): void;
  onUseWebcam(): void;
  onFile(file: File): void;
  /** After "Reset all settings": re-apply anything that isn't read live every frame. */
  onSettingsReset(): void;
  onFrameChange(): void;
  /** Start a countdown, or stop / cancel whatever is in progress. */
  onRecordToggle(): void;
  onRecordCancel(): void;
}

const ERROR_TITLES: Record<CameraErrorKind, string> = {
  denied: 'Camera access is blocked',
  'not-found': 'No camera found',
  busy: 'Camera is busy',
  insecure: 'Camera needs a secure page',
  unknown: 'Camera failed to start',
};

const MEDIA_ACCEPT = 'image/*,video/*';

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing from index.html`);
  return el as T;
}

export class UI {
  private readonly overlay = $<HTMLDivElement>('overlay');
  private readonly icon = $<HTMLDivElement>('overlay-icon');
  private readonly title = $<HTMLHeadingElement>('overlay-title');
  private readonly body = $<HTMLParagraphElement>('overlay-body');
  private readonly action = $<HTMLButtonElement>('overlay-action');
  private readonly secondary = $<HTMLButtonElement>('overlay-secondary');
  private readonly stats = $<HTMLSpanElement>('stats');
  private readonly frozenBadge = $<HTMLSpanElement>('frozen-badge');
  private readonly toastEl = $<HTMLDivElement>('toast');
  private readonly dropzone = $<HTMLDivElement>('dropzone');
  private readonly recordButton = $<HTMLButtonElement>('record');
  private readonly recPill = $<HTMLDivElement>('rec');
  private readonly recTime = $<HTMLSpanElement>('rec-time');
  private readonly recMeta = $<HTMLSpanElement>('rec-meta');
  private readonly countdown = $<HTMLDivElement>('countdown');
  private readonly countdownNumber = $<HTMLSpanElement>('countdown-num');
  private onAction: (() => void) | null = null;
  private toastTimer = 0;
  private cursorTimer = 0;
  private shownSeconds = -1;

  private readonly gui: GUI;
  private sourceControl!: Controller;
  private sweepSpeedControl!: Controller;
  private blurControl!: Controller;
  private recordControl!: Controller;
  private activeSource: SourceName = 'Webcam';

  private frames = 0;
  private statsTime = 0;
  private pinCount = 0;

  constructor(private readonly handlers: UIHandlers) {
    $<HTMLButtonElement>('reset-view').addEventListener('click', handlers.onResetView);
    this.action.addEventListener('click', () => this.onAction?.());
    this.secondary.addEventListener('click', () => this.pickFile(MEDIA_ACCEPT));
    this.recordButton.addEventListener('click', () => handlers.onRecordToggle());
    $<HTMLButtonElement>('rec-stop').addEventListener('click', () => handlers.onRecordToggle());
    window.addEventListener('mousemove', () => this.wakeCursor());

    this.gui = this.buildPanel();
    this.syncDependentControls();
    this.syncFrozen();
    this.bindKeys();
    this.bindDrop();
  }

  // ─── Control panel ───────────────────────────────────────────────────────

  private buildPanel(): GUI {
    const gui = new GUI({ title: 'Pinscreen' });
    const h = this.handlers;

    const source = gui.addFolder('Source');
    this.sourceControl = source
      .add(settings, 'source', ['Webcam', 'Image', 'Video'])
      .name('Input')
      .onChange((value: SourceName) => this.chooseSource(value));
    source.add({ open: () => this.pickFile(MEDIA_ACCEPT) }, 'open').name('Open image or video…');

    const pins = gui.addFolder('Pins');
    pins.add(settings, 'density', Object.keys(DENSITIES)).name('Density').onChange(() => h.onDensityChange());
    pins.add(settings, 'finish', Object.keys(FINISHES)).name('Finish').onChange(() => h.onFinishChange());
    pins.add(settings, 'depth', 0.1, MAX_DEPTH, 0.01).name('Depth');
    pins.add(settings, 'smoothing', 0.02, 1, 0.01).name('Smoothing');
    pins.add(settings, 'frozen').name('Freeze (Space)').listen().onChange(() => this.syncFrozen());

    const picture = gui.addFolder('Picture');
    picture.add(settings, 'autoLevels').name('Auto levels');
    picture.add(settings, 'contrast', 0.5, 3, 0.01).name('Contrast');
    picture.add(settings, 'gamma', 0.3, 3, 0.01).name('Gamma');
    picture.add(settings, 'invert').name('Invert (bright = in)');

    const light = gui.addFolder('Light');
    light.add(settings, 'lightElevation', 3, 60, 0.5).name('Angle (elevation)');
    light.add(settings, 'lightAzimuth', 0, 360, 1).name('Direction').listen();
    light.add(settings, 'autoSweep').name('Auto sweep').onChange(() => this.syncDependentControls());
    this.sweepSpeedControl = light.add(settings, 'sweepSpeed', 1, 45, 0.5).name('Sweep speed (°/s)');
    light.add(settings, 'lightIntensity', 0, 10, 0.1).name('Intensity');
    light.add(settings, 'environment', 0, 2, 0.01).name('Reflections');

    const camera = gui.addFolder('Camera');
    camera.add(settings, 'exposure', 0.2, 2.5, 0.01).name('Exposure');
    camera.add(settings, 'depthOfField').name('Depth of field').onChange(() => this.syncDependentControls());
    this.blurControl = camera.add(settings, 'blur', 0, 1, 0.01).name('Blur');
    camera.add({ reset: () => h.onResetView() }, 'reset').name('Reset view');
    camera.close();

    const record = gui.addFolder('Record');
    record
      .add(settings, 'frame', ['Fill window', ...Object.keys(FRAMES)])
      .name('Frame')
      .onChange(() => h.onFrameChange());
    const formats = supportedFormats();
    if (!formats.includes(settings.recordFormat) && formats.length) settings.recordFormat = formats[0];
    record.add(settings, 'recordFormat', formats.length ? formats : ['MP4']).name('Format').enable(formats.length > 0);
    record.add(settings, 'recordQuality', ['Standard', 'High', 'Max']).name('Quality');
    this.recordControl = record
      .add({ record: () => h.onRecordToggle() }, 'record')
      .name(formats.length ? '● Record (R)' : 'Recording not supported here')
      .enable(formats.length > 0);
    record.add(settings, 'cleanMode').name('Clean mode (C)').listen().onChange(() => this.applyCleanMode());

    gui.add({ reset: () => this.resetAll() }, 'reset').name('Reset all settings');
    gui.onFinishChange(() => saveSettings());

    if (window.innerWidth < 720) gui.close();
    if (!formats.length) this.recordButton.hidden = true;
    return gui;
  }

  private chooseSource(value: SourceName): void {
    if (value === 'Webcam') {
      this.handlers.onUseWebcam();
      return;
    }
    // Stay on the current source until a file actually loads.
    this.setSource(this.activeSource);
    this.pickFile(value === 'Image' ? 'image/*' : 'video/*');
  }

  /** Reflects the source that's really live (after a file loads, or fails to). */
  setSource(kind: SourceName): void {
    this.activeSource = kind;
    settings.source = kind;
    this.sourceControl.updateDisplay();
  }

  private pickFile(accept: string): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) this.handlers.onFile(file);
    });
    input.click();
  }

  private resetAll(): void {
    resetSettings();
    this.handlers.onSettingsReset();
    this.handlers.onFrameChange();
    for (const c of this.gui.controllersRecursive()) c.updateDisplay();
    this.syncDependentControls();
    this.syncFrozen();
    this.toast('Settings reset to defaults');
  }

  private syncDependentControls(): void {
    this.sweepSpeedControl.enable(settings.autoSweep);
    this.blurControl.enable(settings.depthOfField);
  }

  private syncFrozen(): void {
    this.frozenBadge.hidden = !settings.frozen;
  }

  // ─── Keyboard and drag-and-drop ─────────────────────────────────────────

  private bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTyping(e.target)) return;

      if (e.code === 'KeyH') {
        e.preventDefault();
        const hide = !this.gui._hidden;
        this.gui.show(!hide);
        if (hide) this.toast('Panel hidden · press H to bring it back');
      } else if (e.code === 'Space') {
        e.preventDefault();
        // Don't let Space also "click" whichever button or checkbox has focus.
        (document.activeElement as HTMLElement | null)?.blur?.();
        settings.frozen = !settings.frozen;
        this.syncFrozen();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        this.handlers.onRecordToggle();
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        settings.cleanMode = !settings.cleanMode;
        this.applyCleanMode();
      } else if (e.code === 'Escape') {
        this.handlers.onRecordCancel();
      }
    });
  }

  // ─── Recording and clean mode ───────────────────────────────────────────

  /** Hides the chrome while counting down or recording, and flips the record buttons to "stop". */
  setRecordingState(state: RecordingState, meta = ''): void {
    const busy = state !== 'idle';
    document.body.classList.toggle('recording', busy);
    this.recPill.hidden = state !== 'recording' && state !== 'saving';
    this.recPill.classList.toggle('rec--saving', state === 'saving');
    if (state === 'recording') {
      this.recMeta.textContent = meta;
      this.shownSeconds = -1;
      this.setRecordingTime(0);
    }
    if (state === 'saving') this.recTime.textContent = 'Saving…';
    const label = state === 'idle' ? '● Record (R)' : state === 'countdown' ? '✕ Cancel (R)' : '■ Stop (R)';
    this.recordControl.name(label);
    this.recordButton.textContent = state === 'idle' ? '● Record' : '■ Stop';
  }

  /** Shows a big 3-2-1 numeral, or hides the countdown with null. */
  showCountdown(n: number | null): void {
    this.countdown.hidden = n === null;
    if (n === null) return;
    this.countdownNumber.textContent = String(n);
    // Restart the pop-in animation for each number.
    this.countdownNumber.classList.remove('countdown__num--pop');
    void this.countdownNumber.offsetWidth;
    this.countdownNumber.classList.add('countdown__num--pop');
  }

  /** Updates the REC timer; cheap to call every frame (the DOM only changes once a second). */
  setRecordingTime(seconds: number): void {
    const whole = Math.floor(seconds);
    if (whole === this.shownSeconds) return;
    this.shownSeconds = whole;
    this.recTime.textContent = `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
    this.recPill.classList.toggle('rec--long', whole >= X_LIMIT_SECONDS);
  }

  private applyCleanMode(): void {
    document.body.classList.toggle('clean', settings.cleanMode);
    if (settings.cleanMode) {
      this.toast('Clean mode · press C to exit');
      this.wakeCursor();
    } else {
      document.body.classList.remove('idle');
    }
  }

  /** In clean mode the cursor disappears after a moment of stillness, so it stays out of screen captures. */
  private wakeCursor(): void {
    document.body.classList.remove('idle');
    window.clearTimeout(this.cursorTimer);
    if (settings.cleanMode) {
      this.cursorTimer = window.setTimeout(() => document.body.classList.add('idle'), CURSOR_IDLE_MS);
    }
  }

  private bindDrop(): void {
    let depth = 0;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
    window.addEventListener('dragenter', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      this.dropzone.hidden = false;
    });
    window.addEventListener('dragover', (e) => {
      if (hasFiles(e)) e.preventDefault();
    });
    window.addEventListener('dragleave', (e) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) this.dropzone.hidden = true;
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      this.dropzone.hidden = true;
      const file = e.dataTransfer?.files[0];
      if (file) this.handlers.onFile(file);
    });
  }

  // ─── Camera card, toasts, stats ─────────────────────────────────────────

  showCameraPending(): void {
    this.show(
      'pending',
      'Waiting for your camera',
      'Allow camera access in the browser prompt to raise the pins. Video stays on this machine; nothing is uploaded.',
    );
  }

  showCameraError(kind: CameraErrorKind, message: string, retry: () => void): void {
    this.show('error', ERROR_TITLES[kind], message, { label: 'Try again', run: retry });
  }

  hideOverlay(): void {
    this.overlay.hidden = true;
    this.onAction = null;
  }

  private show(state: 'pending' | 'error', title: string, body: string, action?: { label: string; run: () => void }): void {
    this.icon.dataset.state = state;
    this.title.textContent = title;
    this.body.textContent = body;
    this.action.hidden = !action;
    this.secondary.hidden = state !== 'error';
    this.onAction = action?.run ?? null;
    if (action) this.action.textContent = action.label;
    this.overlay.hidden = false;
    if (action) this.action.focus();
  }

  toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('toast--visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('toast--visible'), 2600);
  }

  setPinCount(count: number): void {
    this.pinCount = count;
  }

  /** Call once per rendered frame; refreshes the readout twice a second. */
  tick(now: number): void {
    this.frames++;
    const elapsed = now - this.statsTime;
    if (elapsed < 500) return;
    const fps = Math.round((this.frames * 1000) / elapsed);
    this.stats.textContent = `${this.pinCount.toLocaleString()} pins · ${fps} fps`;
    this.frames = 0;
    this.statsTime = now;
  }
}

/** True when a key press belongs to a text field rather than to the app. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'range'].includes(target.type);
}
