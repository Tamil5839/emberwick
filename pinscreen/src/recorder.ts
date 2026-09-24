// Records the canvas: canvas.captureStream(60) into a MediaRecorder, then
// hands the finished file to the browser as a download.

import type { RecordFormat, RecordQuality } from './settings';

/** Video bitrates. Thousands of tiny glints are hard to compress; skimping shows. */
const BITRATES: Record<RecordQuality, number> = {
  Standard: 12_000_000,
  High: 24_000_000,
  Max: 40_000_000,
};

/** First supported MIME type wins. H.264 High@4.2 covers 1080p60. */
const CANDIDATES: Record<RecordFormat, string[]> = {
  MP4: ['video/mp4;codecs=avc1.64002A', 'video/mp4;codecs=avc1.4D002A', 'video/mp4;codecs=avc1', 'video/mp4'],
  WebM: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
};

const EXTENSIONS: Record<RecordFormat, string> = { MP4: 'mp4', WebM: 'webm' };

function mimeFor(format: RecordFormat): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return CANDIDATES[format].find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

/** Formats this browser can record, MP4 first (it's what X/Twitter and Instagram take). */
export function supportedFormats(): RecordFormat[] {
  return (['MP4', 'WebM'] as RecordFormat[]).filter((f) => mimeFor(f) !== null);
}

export interface Recording {
  blob: Blob;
  filename: string;
}

export class Recorder {
  private recorder: MediaRecorder | null = null;
  private startedAt = 0;
  private stopped: Promise<Recording> | null = null;

  get active(): boolean {
    return this.recorder !== null;
  }

  /** Seconds since recording started. */
  get elapsed(): number {
    return this.recorder ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  /** Starts recording the canvas. `label` goes into the filename, e.g. "16x9". */
  start(canvas: HTMLCanvasElement, format: RecordFormat, quality: RecordQuality, label: string): void {
    if (this.recorder) return;
    const mimeType = mimeFor(format);
    if (!mimeType) throw new Error(`This browser can't record ${format}. Try ${format === 'MP4' ? 'WebM' : 'MP4'}.`);

    const stream = canvas.captureStream(60);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITRATES[quality] });
    const chunks: Blob[] = [];
    recorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    });

    const filename = `pinscreen-${timestamp()}-${label}.${EXTENSIONS[format]}`;
    this.stopped = new Promise<Recording>((resolve, reject) => {
      recorder.addEventListener('stop', () => {
        for (const track of stream.getTracks()) track.stop();
        resolve({ blob: new Blob(chunks, { type: mimeType.split(';')[0] }), filename });
      });
      recorder.addEventListener('error', (e) => reject((e as ErrorEvent).error ?? new Error('Recording failed.')));
    });

    // Flush a chunk every second so a long take never sits in one giant buffer.
    recorder.start(1000);
    this.recorder = recorder;
    this.startedAt = performance.now();
  }

  /** Stops and resolves with the finished file (or null if nothing was recording). */
  async stop(): Promise<Recording | null> {
    const recorder = this.recorder;
    const stopped = this.stopped;
    if (!recorder || !stopped) return null;
    this.recorder = null;
    this.stopped = null;
    if (recorder.state !== 'inactive') recorder.stop();
    return stopped;
  }
}

/** Saves a finished recording through the browser's normal download flow. */
export function download({ blob, filename }: Recording): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser time to start reading the blob before it's released.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
