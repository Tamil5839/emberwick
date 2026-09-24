// Webcam access: getUserMedia at 640x480, with errors sorted into cases the UI
// can explain in plain words.

export type CameraErrorKind = 'denied' | 'not-found' | 'busy' | 'insecure' | 'unknown';

export class CameraError extends Error {
  constructor(
    readonly kind: CameraErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'CameraError';
  }
}

export class Webcam {
  private stream: MediaStream | null = null;

  constructor(readonly video: HTMLVideoElement) {
    video.muted = true;
    video.playsInline = true;
  }

  get active(): boolean {
    return this.stream !== null;
  }

  /** True once the video has decoded at least one frame. */
  get ready(): boolean {
    return this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && this.video.videoWidth > 0;
  }

  async start(onEnded: () => void): Promise<void> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new CameraError(
        'insecure',
        'Browsers only allow camera access on https:// or http://localhost. Open the app from the address `npm run dev` prints.',
      );
    }

    this.stop();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
          facingMode: 'user',
        },
        audio: false,
      });
    } catch (err) {
      throw toCameraError(err);
    }

    this.stream = stream;
    for (const track of stream.getVideoTracks()) {
      track.addEventListener('ended', () => {
        if (this.stream === stream) {
          this.stop();
          onEnded();
        }
      });
    }

    this.video.srcObject = stream;
    try {
      await this.video.play();
    } catch (err) {
      // A newer start() or stop() replaced this stream while play() was pending.
      if (this.stream !== stream) return;
      throw toCameraError(err);
    }
  }

  stop(): void {
    if (!this.stream) return;
    for (const track of this.stream.getTracks()) track.stop();
    this.stream = null;
    this.video.srcObject = null;
  }
}

function toCameraError(err: unknown): CameraError {
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return new CameraError(
        'denied',
        'Camera access was blocked. Click the camera icon in the address bar, allow access for this site, then try again.',
      );
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return new CameraError('not-found', 'No webcam was found. Plug one in, or check that it is enabled, then try again.');
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new CameraError(
        'busy',
        'The camera is in use by another app (Zoom, FaceTime, OBS…). Close it there, then try again.',
      );
    default:
      return new CameraError(
        'unknown',
        `The camera could not be started${err instanceof Error && err.message ? `: ${err.message}` : '.'}`,
      );
  }
}
