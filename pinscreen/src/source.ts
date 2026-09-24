// Where the pins get their picture: the webcam, an uploaded image or an
// uploaded video. Feeds the sampler only when there is a new frame to show.

import type { Webcam } from './camera';
import type { Sampler } from './sampler';
import type { SourceName } from './settings';

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;
const VIDEO_EXTENSION = /\.(mp4|m4v|mov|webm|ogv|mkv)$/i;

export class Sources {
  kind: SourceName = 'Webcam';
  private image: HTMLImageElement | null = null;
  private clip: HTMLVideoElement | null = null;
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
    if (this.kind === 'Image') {
      if (!this.stale || !this.image) return false;
      sampler.capture(this.image, this.image.naturalWidth, this.image.naturalHeight, false);
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
