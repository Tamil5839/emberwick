// Where the pins get their picture: the webcam, an uploaded image or video,
// or typed text. Feeds the sampler only when there is a new frame to show.

import type { Webcam } from './camera';
import type { Sampler } from './sampler';
import type { SourceName } from './settings';

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;
const VIDEO_EXTENSION = /\.(mp4|m4v|mov|webm|ogv|mkv)$/i;
/** Text is drawn at this width (px); plenty of detail for the densest grid to average down. */
const TEXT_CANVAS_WIDTH = 1200;
const TEXT_FONT = '800 {size}px "Helvetica Neue", Helvetica, Arial, sans-serif';

export class Sources {
  kind: SourceName = 'Webcam';
  private image: HTMLImageElement | null = null;
  private clip: HTMLVideoElement | null = null;
  private textCanvas: HTMLCanvasElement | null = null;
  private objectUrl: string | null = null;
  private lastTime = -1;
  private stale = true;

  constructor(
    private readonly webcam: Webcam,
    private readonly host: HTMLElement,
  ) {}

  useWebcam(): void {
    this.releaseFile();
    this.kind = 'Webcam';
    this.invalidate();
  }

  /** Spells `text` out on the pins; call again whenever it changes. `aspect` is the board's. */
  useText(text: string, aspect: number): void {
    this.releaseFile();
    const canvas = (this.textCanvas ??= document.createElement('canvas'));
    canvas.width = TEXT_CANVAS_WIDTH;
    canvas.height = Math.round(TEXT_CANVAS_WIDTH / aspect);
    drawText(canvas, text);
    this.kind = 'Text';
    this.invalidate();
  }

  /** The element the current frame comes from (for segmentation / face detection). */
  element(): HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null {
    switch (this.kind) {
      case 'Webcam':
        return this.webcam.active ? this.webcam.video : null;
      case 'Video':
        return this.clip;
      case 'Image':
        return this.image;
      case 'Text':
        return this.textCanvas;
    }
  }

  /** Loads an image or video file and switches to it. Rejects with a readable message. */
  async useFile(file: File): Promise<SourceName> {
    // Some systems report no MIME type for .mov/.webm, so fall back to the extension.
    if (file.type.startsWith('image/') || IMAGE_EXTENSION.test(file.name)) {
      await this.useImage(file);
      return 'Image';
    }
    if (file.type.startsWith('video/') || VIDEO_EXTENSION.test(file.name)) {
      await this.useVideo(file);
      return 'Video';
    }
    throw new Error(`“${file.name}” isn't an image or a video.`);
  }

  /** Ask for a fresh capture on the next poll (e.g. after the grid is rebuilt). */
  invalidate(): void {
    this.stale = true;
  }

  /** Draws the current frame into the sampler if it's new. Returns true when it did. */
  poll(sampler: Sampler): boolean {
    if (this.kind === 'Image' || this.kind === 'Text') {
      const still = this.kind === 'Image' ? this.image : this.textCanvas;
      if (!this.stale || !still) return false;
      const width = still instanceof HTMLImageElement ? still.naturalWidth : still.width;
      const height = still instanceof HTMLImageElement ? still.naturalHeight : still.height;
      sampler.capture(still, width, height, false);
      this.stale = false;
      return true;
    }

    const video = this.kind === 'Webcam' ? this.webcam.video : this.clip;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return false;
    if (this.kind === 'Webcam' && !this.webcam.active) return false;
    const t = video.currentTime;
    if (!this.stale && t === this.lastTime) return false;
    this.lastTime = t;
    this.stale = false;
    // Only the webcam is mirrored, so it behaves like a mirror; files keep their orientation.
    sampler.capture(video, video.videoWidth, video.videoHeight, this.kind === 'Webcam');
    return true;
  }

  private async useImage(file: File): Promise<void> {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      URL.revokeObjectURL(url);
      throw new Error(`“${file.name}” couldn't be decoded as an image.`);
    }
    this.releaseFile();
    this.image = image;
    this.objectUrl = url;
    this.kind = 'Image';
    this.invalidate();
  }

  private async useVideo(file: File): Promise<void> {
    const url = URL.createObjectURL(file);
    const clip = document.createElement('video');
    clip.className = 'feed';
    clip.muted = true;
    clip.loop = true;
    clip.playsInline = true;
    clip.src = url;
    this.host.append(clip);
    try {
      await new Promise<void>((resolve, reject) => {
        clip.addEventListener('loadeddata', () => resolve(), { once: true });
        clip.addEventListener('error', () => reject(), { once: true });
      });
      await clip.play();
    } catch {
      clip.remove();
      URL.revokeObjectURL(url);
      throw new Error(`“${file.name}” can't be played in this browser. Try an MP4 (H.264) or WebM file.`);
    }
    this.releaseFile();
    this.clip = clip;
    this.objectUrl = url;
    this.kind = 'Video';
    this.invalidate();
  }

  private releaseFile(): void {
    if (this.clip) {
      this.clip.pause();
      this.clip.removeAttribute('src');
      this.clip.load();
      this.clip.remove();
      this.clip = null;
    }
    this.image = null;
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}

/**
 * White text on black, as big as fits. A long phrase breaks onto two lines when
 * that lets it grow, and a slight blur rounds the letters into a soft bevel
 * once they're raised in pins.
 */
function drawText(canvas: HTMLCanvasElement, text: string): void {
  const ctx = canvas.getContext('2d')!;
  const { width: W, height: H } = canvas;
  ctx.filter = 'none';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const content = text.trim();
  if (!content) return;

  const font = (size: number) => TEXT_FONT.replace('{size}', size.toFixed(1));
  ctx.font = font(100);
  const fit = (lines: string[], maxHeightShare: number) => {
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
    return Math.min(H * maxHeightShare, ((W * 0.88) / widest) * 100);
  };

  let lines = [content];
  let size = fit(lines, 0.62);
  const spaces = [...content.matchAll(/ /g)].map((m) => m.index ?? 0);
  if (size < H * 0.3 && spaces.length) {
    // Break at the space nearest the middle.
    const middle = content.length / 2;
    const at = spaces.reduce((best, i) => (Math.abs(i - middle) < Math.abs(best - middle) ? i : best));
    const split = [content.slice(0, at).trim(), content.slice(at + 1).trim()];
    const splitSize = fit(split, 0.38);
    if (splitSize > size) {
      lines = split;
      size = splitSize;
    }
  }

  ctx.font = font(size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.filter = `blur(${(size * 0.035).toFixed(1)}px)`;
  const lineHeight = size * 1.05;
  const top = H / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, W / 2, top + i * lineHeight));
  ctx.filter = 'none';
}
