// Turns a video/image frame into one 0..1 height per pin: draw the frame into
// a tiny canvas at grid resolution, take luminance, then levels, contrast,
// gamma and invert through a 256-entry lookup table. An optional person mask
// (from segmentation) keeps the background flat.

import { ROW_SPACING, settings } from './settings';

export type SampleSource = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap;

/** Percentiles used by auto levels, so a few specular pixels can't set the white point. */
const LOW_PERCENTILE = 0.02;
const HIGH_PERCENTILE = 0.985;
/** Smallest level span auto levels may stretch to, so a dark, flat frame doesn't become noise. */
const MIN_LEVEL_SPAN = 56;
/** Person-mask confidence ramp: below LOW is background, above HIGH fully person. */
const MASK_LOW = 0.3;
const MASK_HIGH = 0.7;
/** With a mask, levels come from the person only, if at least this share of the frame is person. */
const MIN_PERSON_SHARE = 0.04;

/** How the last frame was cropped and flipped, so a mask can be sampled the same way. */
interface Crop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  sourceWidth: number;
  sourceHeight: number;
  mirror: boolean;
}

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
  /** Person weight per canvas pixel, 0..1, when a mask is active. */
  private mask = new Float32Array(0);
  private maskActive = false;
  private readonly histogram = new Uint32Array(256);
  private readonly lut = new Float32Array(256);
  private readonly crop: Crop = { sx: 0, sy: 0, sw: 1, sh: 1, sourceWidth: 1, sourceHeight: 1, mirror: false };

  private frameReady = false;
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
    this.mask = new Float32Array(this.width * rows);
    this.maskActive = false;
    this.frameReady = false;
  }

  /** True once a frame has been captured since the last resize or clear. */
  get ready(): boolean {
    return this.frameReady;
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
    const { ctx, width, rows, crop } = this;

    // Crop the source to the board's aspect so the face isn't stretched.
    const target = this.aspect;
    crop.sx = 0;
    crop.sy = 0;
    crop.sw = sourceWidth;
    crop.sh = sourceHeight;
    if (sourceWidth / sourceHeight > target) {
      crop.sw = sourceHeight * target;
      crop.sx = (sourceWidth - crop.sw) / 2;
    } else {
      crop.sh = sourceWidth / target;
      crop.sy = (sourceHeight - crop.sh) / 2;
    }
    crop.sourceWidth = sourceWidth;
    crop.sourceHeight = sourceHeight;
    crop.mirror = mirror;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (mirror) ctx.setTransform(-1, 0, 0, 1, width, 0);
    ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, rows);
    if (mirror) ctx.setTransform(1, 0, 0, 1, 0, 0);

    this.readLuma();
  }

  /** Reads the current canvas contents (whatever drew them) as the new frame. */
  readLuma(): void {
    const { luma } = this;
    // getImageData is the one unavoidable allocation per camera frame (~40 KB).
    const rgba = this.ctx.getImageData(0, 0, this.width, this.rows).data;
    for (let i = 0, p = 0; i < luma.length; i++, p += 4) {
      // Rec. 709 luma weights in 8.8 fixed point.
      luma[i] = (54 * rgba[p] + 183 * rgba[p + 1] + 19 * rgba[p + 2]) >> 8;
    }
    this.updateLevels();
    this.frameReady = true;
  }

  /**
   * Applies a person-confidence mask (e.g. MediaPipe's, at the source's own
   * resolution) for the frame just captured, or removes it with null.
   */
  setMask(data: Float32Array | null, maskWidth = 0, maskHeight = 0): void {
    if (!data || maskWidth === 0 || maskHeight === 0) {
      if (this.maskActive) {
        this.maskActive = false;
        this.updateLevels();
      }
      return;
    }
    const { mask, width, rows, crop } = this;
    const scaleX = maskWidth / crop.sourceWidth;
    const scaleY = maskHeight / crop.sourceHeight;
    const span = MASK_HIGH - MASK_LOW;
    for (let r = 0; r < rows; r++) {
      const my = Math.min(maskHeight - 1, Math.floor((crop.sy + ((r + 0.5) / rows) * crop.sh) * scaleY));
      const rowOffset = my * maskWidth;
      for (let j = 0; j < width; j++) {
        // The canvas is drawn mirrored for the webcam, so read the mask the same way.
        const sj = crop.mirror ? width - 1 - j : j;
        const mx = Math.min(maskWidth - 1, Math.floor((crop.sx + ((sj + 0.5) / width) * crop.sw) * scaleX));
        const t = (data[rowOffset + mx] - MASK_LOW) / span;
        const w = t < 0 ? 0 : t > 1 ? 1 : t;
        mask[r * width + j] = w * w * (3 - 2 * w);
      }
    }
    this.maskActive = true;
    this.updateLevels();
  }

  /** Auto levels from the frame's histogram (person pixels only, when masked). */
  private updateLevels(): void {
    const { luma, histogram, mask } = this;
    histogram.fill(0);
    let counted = 0;
    if (this.maskActive) {
      for (let i = 0; i < luma.length; i++) {
        if (mask[i] > 0.5) {
          histogram[luma[i]]++;
          counted++;
        }
      }
    }
    if (counted < luma.length * MIN_PERSON_SHARE) {
      histogram.fill(0);
      for (let i = 0; i < luma.length; i++) histogram[luma[i]]++;
      counted = luma.length;
    }

    const lowCount = counted * LOW_PERCENTILE;
    const highCount = counted * HIGH_PERCENTILE;
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
    if (!this.frameReady) {
      this.black = black;
      this.white = white;
    }
  }

  /** Maps the latest luminance through levels/contrast/gamma into `values`. Cheap; run every frame. */
  apply(dt: number): Float32Array {
    const { values, luma, lut, cols, rows, width, mask } = this;
    if (!this.frameReady) return values;

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

    const masked = this.maskActive;
    for (let r = 0; r < rows; r++) {
      const src = r * width;
      const dst = r * cols;
      if (r & 1) {
        // Odd rows sit half a pitch to the right: average the two pixels they straddle.
        for (let c = 0; c < cols; c++) {
          const a = src + c;
          values[dst + c] = masked
            ? 0.5 * (lut[luma[a]] * mask[a] + lut[luma[a + 1]] * mask[a + 1])
            : 0.5 * (lut[luma[a]] + lut[luma[a + 1]]);
        }
      } else {
        for (let c = 0; c < cols; c++) {
          const a = src + c;
          values[dst + c] = masked ? lut[luma[a]] * mask[a] : lut[luma[a]];
        }
      }
    }
    return values;
  }

  /** Forget the current frame so the pins fall back flat. */
  clear(): void {
    this.frameReady = false;
    this.maskActive = false;
    this.values.fill(0);
  }
}
