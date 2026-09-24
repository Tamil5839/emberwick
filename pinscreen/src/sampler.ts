// Turns a video/image frame into one 0..1 height per pin: draw the frame into
// a tiny canvas at grid resolution, take luminance, then levels, contrast,
// gamma and invert through a 256-entry lookup table.

import { ROW_SPACING, settings } from './settings';

export type SampleSource = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap;

/** Percentiles used by auto levels, so a few specular pixels can't set the white point. */
const LOW_PERCENTILE = 0.02;
const HIGH_PERCENTILE = 0.985;
/** Smallest level span auto levels may stretch to, so a dark, flat frame doesn't become noise. */
const MIN_LEVEL_SPAN = 56;

export class Sampler {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  cols = 0;
  rows = 0;
  /** Canvas width: one extra column so odd (half-shifted) rows can sample between pixels. */
  private width = 0;

  /** Per-pin output, 0 (pin fully in) to 1 (fully out), row-major from the top-left pin. */
  values = new Float32Array(0);
  private luma = new Uint8Array(0);
  private readonly histogram = new Uint32Array(256);
  private readonly lut = new Float32Array(256);

  private hasFrame = false;
  private targetBlack = 0;
  private targetWhite = 255;
  private black = 0;
  private white = 255;

  constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true, alpha: false });
    if (!ctx) throw new Error('2D canvas is not available');
    this.ctx = ctx;
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.width = cols + 1;
    this.canvas.width = this.width;
    this.canvas.height = rows;
    this.values = new Float32Array(cols * rows);
    this.luma = new Uint8Array(this.width * rows);
    this.hasFrame = false;
  }

  /** Physical aspect ratio (width / height) of the area the pins cover. */
  get aspect(): number {
    return this.width / (this.rows * ROW_SPACING);
  }

  /**
   * Draws one frame into the sampler canvas (cover-fit, optionally mirrored)
   * and reads back its luminance. Call it only when the source has a new frame.
   */
  capture(source: SampleSource, sourceWidth: number, sourceHeight: number, mirror: boolean): void {
    if (sourceWidth === 0 || sourceHeight === 0) return;
    const { ctx, width, rows } = this;

    // Crop the source to the board's aspect so the face isn't stretched.
    const target = this.aspect;
    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;
    if (sourceWidth / sourceHeight > target) {
      sw = sourceHeight * target;
      sx = (sourceWidth - sw) / 2;
    } else {
      sh = sourceWidth / target;
      sy = (sourceHeight - sh) / 2;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (mirror) ctx.setTransform(-1, 0, 0, 1, width, 0);
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, rows);
    if (mirror) ctx.setTransform(1, 0, 0, 1, 0, 0);

    this.readLuma();
  }

  /** Reads the current canvas contents (whatever drew them) as the new frame. */
  readLuma(): void {
    const { luma, histogram } = this;
    // getImageData is the one unavoidable allocation per camera frame (~40 KB).
    const rgba = this.ctx.getImageData(0, 0, this.width, this.rows).data;
    histogram.fill(0);
    for (let i = 0, p = 0; i < luma.length; i++, p += 4) {
      // Rec. 709 luma weights in 8.8 fixed point.
      const y = (54 * rgba[p] + 183 * rgba[p + 1] + 19 * rgba[p + 2]) >> 8;
      luma[i] = y;
      histogram[y]++;
    }

    const lowCount = luma.length * LOW_PERCENTILE;
    const highCount = luma.length * HIGH_PERCENTILE;
    let black = -1;
    let white = 255;
    for (let v = 0, sum = 0; v < 256; v++) {
      sum += histogram[v];
      if (black < 0 && sum > lowCount) black = v;
      if (sum >= highCount) {
        white = v;
        break;
      }
    }
    black = Math.max(black, 0);
    if (white - black < MIN_LEVEL_SPAN) {
      const mid = (white + black) / 2;
      black = Math.max(0, mid - MIN_LEVEL_SPAN / 2);
      white = Math.min(255, black + MIN_LEVEL_SPAN);
    }
    this.targetBlack = black;
    this.targetWhite = white;
    if (!this.hasFrame) {
      this.black = black;
      this.white = white;
      this.hasFrame = true;
    }
  }

  /** Maps the latest luminance through levels/contrast/gamma into `values`. Cheap; run every frame. */
  apply(dt: number): Float32Array {
    const { values, luma, lut, cols, rows, width } = this;
    if (!this.hasFrame) return values;

    let black = 0;
    let white = 255;
    if (settings.autoLevels) {
      // Ease the levels so exposure changes don't make the whole board pump.
      const k = 1 - Math.exp(-dt * 2.5);
      this.black += (this.targetBlack - this.black) * k;
      this.white += (this.targetWhite - this.white) * k;
      black = this.black;
      white = this.white;
    }

    const span = Math.max(1, white - black);
    const contrast = settings.contrast;
    const invGamma = 1 / Math.max(0.05, settings.gamma);
    const invert = settings.invert;
    for (let i = 0; i < 256; i++) {
      let v = (i - black) / span;
      v = (v - 0.5) * contrast + 0.5;
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      v = Math.pow(v, invGamma);
      lut[i] = invert ? 1 - v : v;
    }

    for (let r = 0; r < rows; r++) {
      const src = r * width;
      const dst = r * cols;
      if (r & 1) {
        // Odd rows sit half a pitch to the right: average the two pixels they straddle.
        for (let c = 0; c < cols; c++) values[dst + c] = 0.5 * (lut[luma[src + c]] + lut[luma[src + c + 1]]);
      } else {
        for (let c = 0; c < cols; c++) values[dst + c] = lut[luma[src + c]];
      }
    }
    return values;
  }

  /** Forget the current frame so the pins fall back flat. */
  clear(): void {
    this.hasFrame = false;
    this.values.fill(0);
  }
}
