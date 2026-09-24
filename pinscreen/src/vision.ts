// MediaPipe (tasks-vision) helpers: selfie segmentation for "person only" and
// face detection for the idle mode. Loaded on demand with a dynamic import, so
// none of this (or its ~12 MB of WebAssembly) is fetched until it's needed.
// The WebAssembly ships from node_modules and the models from public/models,
// so nothing depends on a CDN.

import { FaceDetector, ImageSegmenter, type ImageSource } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';

const FILESET = { wasmLoaderPath, wasmBinaryPath };
const MODELS = `${import.meta.env.BASE_URL}models/`;

/**
 * MediaPipe Tasks post usage metrics (never the camera images) to Google once
 * a minute, and offer no switch to turn that off. Pinscreen promises that
 * nothing leaves the machine, so requests to that one host are refused before
 * they're sent; the library then stops trying.
 */
const METRICS_HOST = 'odml.pa.googleapis.com';
const realFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes(METRICS_HOST)) return Promise.reject(new TypeError('MediaPipe usage metrics are disabled in Pinscreen'));
  return realFetch(input, init);
};

/** MediaPipe wants strictly increasing timestamps per task. */
function clock(): () => number {
  let last = 0;
  return () => {
    last = Math.max(performance.now(), last + 1);
    return last;
  };
}

/** Person segmentation: a confidence mask (0 background … 1 person) at the source's resolution. */
export class Segmenter {
  mask = new Float32Array(0);
  width = 0;
  height = 0;
  private readonly now = clock();

  private constructor(private readonly task: ImageSegmenter) {}

  static async create(): Promise<Segmenter> {
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: `${MODELS}selfie_segmenter.tflite`, delegate },
      runningMode: 'VIDEO' as const,
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
    try {
      return new Segmenter(await ImageSegmenter.createFromOptions(FILESET, options('GPU')));
    } catch {
      // Some GPUs/browsers can't run the WebGL delegate; the CPU one always works.
      return new Segmenter(await ImageSegmenter.createFromOptions(FILESET, options('CPU')));
    }
  }

  /** Segments one frame; the result lands in `mask` / `width` / `height`. */
  segment(source: ImageSource): void {
    this.task.segmentForVideo(source, this.now(), (result) => {
      const masks = result.confidenceMasks;
      if (!masks?.length) return;
      // Two-class models report [background, person]; single-channel ones just person.
      const person = masks[masks.length - 1];
      const data = person.getAsFloat32Array();
      if (this.mask.length !== data.length) this.mask = new Float32Array(data.length);
      this.mask.set(data);
      this.width = person.width;
      this.height = person.height;
    });
  }

  close(): void {
    this.task.close();
  }
}

/** Is there a face in frame? Cheap enough to ask a few times a second. */
export class FaceWatcher {
  private readonly now = clock();

  private constructor(private readonly task: FaceDetector) {}

  static async create(): Promise<FaceWatcher> {
    const task = await FaceDetector.createFromOptions(FILESET, {
      baseOptions: { modelAssetPath: `${MODELS}blaze_face_short_range.tflite`, delegate: 'CPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    });
    return new FaceWatcher(task);
  }

  hasFace(source: ImageSource): boolean {
    return this.task.detectForVideo(source, this.now()).detections.length > 0;
  }

  close(): void {
    this.task.close();
  }
}
