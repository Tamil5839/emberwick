import { CameraError, Webcam } from './camera';
import { Lighting } from './lighting';
import { PinField } from './pinfield';
import { Sampler } from './sampler';
import { DENSITIES, settings } from './settings';
import { Stage } from './stage';
import { UI } from './ui';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const video = document.getElementById('webcam') as HTMLVideoElement;

const stage = new Stage(canvas);
const lighting = new Lighting(stage.scene, stage.renderer);
const pins = new PinField();
const sampler = new Sampler();
const webcam = new Webcam(video);
const ui = new UI({ onResetView: () => stage.resetView() });

stage.scene.add(pins.group);

function buildBoard(): void {
  const { cols, rows } = DENSITIES[settings.density];
  pins.build(cols, rows);
  sampler.resize(cols, rows);
  lighting.setBounds(() => pins.bounds);
  stage.setBoardSize(pins.layout.plateWidth + 1, pins.layout.plateHeight + 1);
  ui.setPinCount(pins.layout.count);
}

buildBoard();
stage.resetView();

async function startCamera(): Promise<void> {
  ui.showCameraPending();
  try {
    await webcam.start(() => {
      sampler.clear();
      ui.showCameraError('not-found', 'The camera was disconnected or turned off.', startCamera);
    });
    ui.hideOverlay();
  } catch (err) {
    const e = err instanceof CameraError ? err : new CameraError('unknown', String(err));
    ui.showCameraError(e.kind, e.message, startCamera);
  }
}

// Sample only when the webcam delivers a new frame (usually 30 Hz); the pins
// still ease at the display rate in between.
let lastVideoTime = -1;
function sampleWebcam(): void {
  if (!webcam.active || !webcam.ready) return;
  const t = video.currentTime;
  if (t === lastVideoTime) return;
  lastVideoTime = t;
  sampler.capture(video, video.videoWidth, video.videoHeight, true);
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  sampleWebcam();
  const values = sampler.apply(dt);
  pins.update(values, dt);
  lighting.update();
  stage.render();
  ui.tick(now);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

startCamera();

// Handy for tweaking from the dev console: __pinscreen.settings.depth = 1.2
if (import.meta.env.DEV) {
  Object.assign(window, { __pinscreen: { settings, stage, pins, lighting, sampler } });
}
