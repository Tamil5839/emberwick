import { CameraError, Webcam } from './camera';
import { Lighting } from './lighting';
import { PinField } from './pinfield';
import { download, Recorder } from './recorder';
import { Sampler } from './sampler';
import { DENSITIES, FRAMES, loadSettings, settings } from './settings';
import { Sources } from './source';
import { Stage } from './stage';
import { type RecordingState, UI } from './ui';

loadSettings();

const app = document.getElementById('app') as HTMLDivElement;
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const video = document.getElementById('webcam') as HTMLVideoElement;

const stage = new Stage(canvas);
const lighting = new Lighting(stage.scene, stage.renderer);
const pins = new PinField();
const sampler = new Sampler();
const webcam = new Webcam(video);
const sources = new Sources(webcam, app);
const ui = new UI({
  onResetView: () => stage.resetView(),
  onDensityChange: () => buildBoard(),
  onFinishChange: () => pins.setFinish(settings.finish),
  onUseWebcam: () => useWebcam(),
  onFile: (file) => useFile(file),
  onSettingsReset: () => {
    if (builtDensity !== settings.density) buildBoard();
    pins.setFinish(settings.finish);
  },
  onFrameChange: () => applyFrame(),
  onRecordToggle: () => toggleRecording(),
  onRecordCancel: () => {
    if (recState === 'countdown') cancelCountdown();
    else if (recState === 'recording') stopRecording();
  },
});

stage.scene.add(pins.group);

let builtDensity = settings.density;
/** Set when the pins were rebuilt while frozen: snap them to the next frame, then hold. */
let snapWhenFrozen = false;
let shadowsDirty = true;

const recorder = new Recorder();
let recState: RecordingState = 'idle';
let countdownTimer = 0;

function buildBoard(): void {
  const { cols, rows } = DENSITIES[settings.density];
  builtDensity = settings.density;
  pins.build(cols, rows);
  sampler.resize(cols, rows);
  sources.invalidate();
  lighting.setBounds(() => pins.bounds);
  stage.setBoardSize(pins.layout.plateWidth + 1, pins.layout.plateHeight + 1);
  ui.setPinCount(pins.layout.count);
  snapWhenFrozen = settings.frozen;
  shadowsDirty = true;
}

buildBoard();
applyFrame();
stage.resetView();

async function startCamera(): Promise<void> {
  ui.showCameraPending();
  try {
    await webcam.start(() => {
      if (sources.kind !== 'Webcam') return;
      sampler.clear();
      ui.showCameraError('not-found', 'The camera was disconnected or turned off.', startCamera);
    });
    // The user may have switched to a file while the permission prompt was up.
    if (sources.kind === 'Webcam') ui.hideOverlay();
    else webcam.stop();
  } catch (err) {
    if (sources.kind !== 'Webcam') return;
    const e = err instanceof CameraError ? err : new CameraError('unknown', String(err));
    ui.showCameraError(e.kind, e.message, startCamera);
  }
}

function useWebcam(): void {
  sources.useWebcam();
  ui.setSource('Webcam');
  startCamera();
}

async function useFile(file: File): Promise<void> {
  try {
    const kind = await sources.useFile(file);
    // Release the camera (and its light) while a file drives the pins.
    webcam.stop();
    ui.hideOverlay();
    ui.setSource(kind);
    ui.toast(`Showing ${file.name}`);
  } catch (err) {
    ui.toast(err instanceof Error ? err.message : String(err));
  }
}

// ─── Recording: 3-2-1, capture at the exact output size, save ────────────

/** Letterbox the live view to the chosen output frame (when not recording). */
function applyFrame(): void {
  if (recState !== 'idle') return;
  stage.setFrame(settings.frame === 'Fill window' ? null : FRAMES[settings.frame]);
}

function setRecState(state: RecordingState, meta = ''): void {
  recState = state;
  ui.setRecordingState(state, meta);
}

function toggleRecording(): void {
  if (recState === 'idle') startCountdown();
  else if (recState === 'countdown') cancelCountdown();
  else if (recState === 'recording') stopRecording();
}

function startCountdown(): void {
  // "Fill window" records as 16:9, the closest match to a laptop screen.
  const name = settings.frame === 'Fill window' ? '16:9' : settings.frame;
  const output = FRAMES[name];
  // Switch to the exact pixel size now, so the first recorded frame is already warm.
  stage.setFrame(output, true);
  setRecState('countdown');
  let n = 3;
  ui.showCountdown(n);
  countdownTimer = window.setInterval(() => {
    n--;
    if (n > 0) {
      ui.showCountdown(n);
      return;
    }
    window.clearInterval(countdownTimer);
    ui.showCountdown(null);
    try {
      recorder.start(canvas, settings.recordFormat, settings.recordQuality, output.label);
      setRecState('recording', `${name} · ${output.width}×${output.height}`);
    } catch (err) {
      ui.toast(err instanceof Error ? err.message : String(err));
      endRecording();
    }
  }, 1000);
}

function cancelCountdown(): void {
  window.clearInterval(countdownTimer);
  ui.showCountdown(null);
  endRecording();
  ui.toast('Recording cancelled');
}

async function stopRecording(): Promise<void> {
  setRecState('saving');
  try {
    const recording = await recorder.stop();
    if (recording) {
      download(recording);
      const mb = (recording.blob.size / 1_000_000).toFixed(1);
      ui.toast(`Saved ${recording.filename} · ${mb} MB`);
    }
  } catch (err) {
    ui.toast(`Recording failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    endRecording();
  }
}

function endRecording(): void {
  setRecState('idle');
  applyFrame();
}

// Don't lose a take to a stray reload or tab close.
window.addEventListener('beforeunload', (e) => {
  if (recState !== 'idle') e.preventDefault();
});

// ─── Frame loop ──────────────────────────────────────────────────────────

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  let shadowsChanged = lighting.update(dt) || shadowsDirty;
  shadowsDirty = false;

  if (!settings.frozen || snapWhenFrozen) {
    sources.poll(sampler);
    const values = sampler.apply(dt);
    if (!settings.frozen) {
      pins.update(values, dt);
      shadowsChanged = true;
    } else if (sampler.ready) {
      pins.update(values, dt, true);
      snapWhenFrozen = false;
      shadowsChanged = true;
    }
  }

  stage.render(shadowsChanged);
  ui.tick(now);
  if (recState === 'recording') ui.setRecordingTime(recorder.elapsed);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

startCamera();

// Handy for poking at from the dev console: __pinscreen.settings.depth = 1.2
if (import.meta.env.DEV) {
  Object.assign(window, { __pinscreen: { settings, stage, pins, lighting, sampler, sources, ui, recorder } });
}
