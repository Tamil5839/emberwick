// DOM chrome: the camera permission / error card, the stats readout and the
// reset-view button. The control panel joins this module in phase 2.

import type { CameraErrorKind } from './camera';

const ERROR_TITLES: Record<CameraErrorKind, string> = {
  denied: 'Camera access is blocked',
  'not-found': 'No camera found',
  busy: 'Camera is busy',
  insecure: 'Camera needs a secure page',
  unknown: 'Camera failed to start',
};

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
  private readonly stats = $<HTMLSpanElement>('stats');
  private onAction: (() => void) | null = null;

  private frames = 0;
  private statsTime = 0;
  private pinCount = 0;

  constructor(handlers: { onResetView: () => void }) {
    $<HTMLButtonElement>('reset-view').addEventListener('click', handlers.onResetView);
    this.action.addEventListener('click', () => this.onAction?.());
  }

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
    this.onAction = action?.run ?? null;
    if (action) this.action.textContent = action.label;
    this.overlay.hidden = false;
    if (action) this.action.focus();
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
