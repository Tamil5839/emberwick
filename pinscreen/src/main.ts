import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { CameraError, Webcam } from './camera';
import { Breath, Idle, Ripples } from './effects';
import { Lighting } from './lighting';
import { PinField } from './pinfield';
import { download, Recorder } from './recorder';
import { Sampler } from './sampler';
import { DENSITIES, FRAMES, loadSettings, ROW_SPACING, settings } from './settings';
import { Sources } from './source';
import { Stage } from './stage';
import { type RecordingState, UI } from './ui';
import type { FaceWatcher, Segmenter } from './vision';

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
const ripples = new Ripples();
const breath = new Breath();
const idle = new Idle();
const ui = new UI({
  onResetView: () => stage.resetView(),
  onDensityChange: () => buildBoard(),
  onFinishChange: () => pins.setFinish(settings.finish),
  onUseWebcam: () => useWebcam(),
  onUseText: () => useText(),
  onTextChange: () => {
    if (sources.kind === 'Text') sources.useText(settings.text, sampler.aspect);
  },
  onFile: (file) => useFile(file),
  onSegmentationChange: () => applySegmentation(),
  onIdleChange: () => applyIdle(),
  onSettingsReset: () => {
    if (builtDensity !== settings.density) buildBoard();
    pins.setFinish(settings.finish);
    if (sources.kind === 'Text') sources.useText(settings.text, sampler.aspect);
    applySegmentation();
    applyIdle();
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
/** Per-pin targets after mixing in the idle breathing, and per-pin ripple offsets. */
let targets = new Float32Array(0);
let offsets = new Float32Array(0);
let wasRippling = false;

const recorder = new Recorder();
let recState: RecordingState = 'idle';
let countdownTimer = 0;

let segmenter: Segmenter | null = null;
let faceWatcher: FaceWatcher | null = null;
let facePresent = false;
let lastFaceCheck = 0;
const FACE_CHECK_MS = 400;

function buildBoard(): void {
  const { cols, rows } = DENSITIES[settings.density];
  builtDensity = settings.density;
  pins.build(cols, rows);
  sampler.resize(cols, rows);
  breath.resize(cols, rows, pins.layout.pitch, pins.layout.pitch * ROW_SPACING);
  targets = new Float32Array(pins.layout.count);
  offsets = new Float32Array(pins.layout.count);
  if (sources.kind === 'Text') sources.useText(settings.text, sampler.aspect);
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

// ─── Sources ─────────────────────────────────────────────────────────────

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

function useText(): void {
  sources.useText(settings.text, sampler.aspect);
  // Release the camera (and its light) while something else drives the pins.
  webcam.stop();
  ui.hideOverlay();
  ui.setSource('Text');
}

async function useFile(file: File): Promise<void> {
  try {
    const kind = await sources.useFile(file);
    webcam.stop();
    ui.hideOverlay();
    ui.setSource(kind);
    ui.toast(`Showing ${file.name}`);
  } catch (err) {
    ui.toast(err instanceof Error ? err.message : String(err));
  }
}

// ─── MediaPipe: person segmentation and face presence (loaded on demand) ──

async function applySegmentation(): Promise<void> {
  if (!settings.segmentation) {
    sampler.setMask(null);
    return;
  }
  if (segmenter) return;
  ui.toast('Loading person segmentation…');
  try {
    const { Segmenter } = await import('./vision');
    segmenter = await Segmenter.create();
    sources.invalidate();
    if (settings.segmentation) ui.toast('Person only: the background stays flat');
  } catch (err) {
    console.error(err);
    settings.segmentation = false;
    ui.refresh();
    ui.toast("Person segmentation couldn't start in this browser");
  }
}

async function applyIdle(): Promise<void> {
  if (!settings.idleBreath || faceWatcher) return;
  try {
    const { FaceWatcher } = await import('./vision');
    faceWatcher = await FaceWatcher.create();
  } catch (err) {
    // Without a detector the board still breathes whenever there's no picture at all.
    console.warn('Face detection unavailable; idle mode will only react to a missing camera.', err);
  }
}

/** Runs segmentation on the frame the sampler just captured (or clears the mask). */
function segmentFrame(): void {
  const element = sources.element();
  if (!settings.segmentation || !segmenter || !element || sources.kind === 'Text') {
    sampler.setMask(null);
    return;
  }
  try {
    segmenter.segment(element);
    sampler.setMask(segmenter.mask, segmenter.width, segmenter.height);
  } catch (err) {
    console.warn('Segmentation failed on this frame', err);
    sampler.setMask(null);
  }
}

/**
 * Is someone there? No picture at all always counts as away. For the webcam,
 * a face must be visible (checked a couple of times a second, not every
 * frame); images, videos and text count as present once they're showing.
 */
function checkPresence(now: number): boolean {
  if (sources.kind === 'Text') return true;
  if (!sampler.ready) return false;
  if (sources.kind !== 'Webcam' || !faceWatcher || !settings.idleBreath) return true;
  if (now - lastFaceCheck > FACE_CHECK_MS) {
    lastFaceCheck = now;
    // A camera that's (re)starting has no frame yet; MediaPipe throws on those.
    if (!webcam.ready) return facePresent;
    try {
      facePresent = faceWatcher.hasFace(webcam.video);
    } catch (err) {
      console.warn('Face detection failed on this frame', err);
      facePresent = true;
    }
  }
  return facePresent;
}

// ─── Ripples: a click (not a drag) on the board ──────────────────────────

const raycaster = new Raycaster();
const pointer = new Vector2();
const hit = new Vector3();
const reliefPlane = new Plane(new Vector3(0, 0, 1), 0);
let pressX = 0;
let pressY = 0;
let pressTime = 0;

canvas.addEventListener('pointerdown', (e) => {
  pressX = e.clientX;
  pressY = e.clientY;
  pressTime = e.timeStamp;
});
canvas.addEventListener('pointerup', (e) => {
  if (!settings.ripples || e.button !== 0) return;
  // A quick press that barely moved is a click; anything else was an orbit drag.
  const moved = Math.hypot(e.clientX - pressX, e.clientY - pressY);
  if (moved > 6 || e.timeStamp - pressTime > 400) return;
  const rect = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, stage.camera);
  reliefPlane.constant = -pins.midZ;
  if (raycaster.ray.intersectPlane(reliefPlane, hit) && pins.contains(hit.x, hit.y)) {
    ripples.add(hit.x, hit.y, performance.now() / 1000);
  }
});

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
let loopErrors = 0;
function frame(now: number): void {
  // Schedule first, so no single bad frame can ever stop the animation.
  requestAnimationFrame(frame);
  try {
    step(now);
  } catch (err) {
    if (loopErrors++ < 5) console.error(err);
  }
}

function step(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const seconds = now / 1000;

  let shadowsChanged = lighting.update(dt) || shadowsDirty;
  shadowsDirty = false;

  const rippling = settings.ripples && ripples.apply(offsets, pins.posX, pins.posY, seconds);
  const rippleOffsets = rippling ? offsets : null;

  if (!settings.frozen || snapWhenFrozen) {
    if (sources.poll(sampler)) segmentFrame();
    let values = sampler.apply(dt);

    // With nobody in front of the camera, fade into slow breathing.
    const away = idle.update(seconds, dt, checkPresence(now), settings.idleBreath);
    if (away > 0) {
      const b = breath.update(seconds);
      for (let i = 0; i < targets.length; i++) targets[i] = values[i] + (b[i] - values[i]) * away;
      values = targets;
    }

    if (!settings.frozen) {
      pins.update(values, dt, false, rippleOffsets);
      shadowsChanged = true;
    } else if (sampler.ready) {
      pins.update(values, dt, true, rippleOffsets);
      snapWhenFrozen = false;
      shadowsChanged = true;
    }
  } else if (rippling || wasRippling) {
    // Frozen pins still ripple; one last pass once the waves die clears their offsets.
    pins.update(null, dt, false, rippleOffsets);
    shadowsChanged = true;
  }
  wasRippling = rippling;

  stage.render(shadowsChanged);
  ui.tick(now);
  if (recState === 'recording') ui.setRecordingTime(recorder.elapsed);
}
requestAnimationFrame(frame);

startCamera();
if (settings.segmentation) applySegmentation();
// Give the camera a head start before pulling in MediaPipe for face presence.
if (settings.idleBreath) window.setTimeout(applyIdle, 1500);

// Handy for poking at from the dev console: __pinscreen.settings.depth = 1.2
if (import.meta.env.DEV) {
  Object.assign(window, {
    __pinscreen: {
      settings, stage, pins, lighting, sampler, sources, ui, recorder, ripples, idle,
      get facePresent() {
        return facePresent;
      },
    },
  });
}
