// Things the pins do besides showing the picture: ripples that spread from a
// click, and slow simplex-noise breathing while nobody is in front of the camera.

import { createNoise3D } from 'simplex-noise';

// ─── Ripples ───────────────────────────────────────────────────────────────

const MAX_RIPPLES = 8;
/** Wavefront speed, world units per second (the board is 16 wide). */
const RIPPLE_SPEED = 6.5;
const RIPPLE_WAVELENGTH = 1.8;
/** Width (sigma) of the travelling wave packet. */
const RIPPLE_WIDTH = 0.9;
const RIPPLE_LIFETIME = 3;
/** Peak lift in world units. */
const RIPPLE_HEIGHT = 0.5;

/** Circular waves launched from clicks, summed into a per-pin height offset. */
export class Ripples {
  private readonly x = new Float32Array(MAX_RIPPLES);
  private readonly y = new Float32Array(MAX_RIPPLES);
  private readonly born = new Float64Array(MAX_RIPPLES).fill(-Infinity);
  private next = 0;

  /** Launches a ripple at world (x, y). `now` is in seconds. */
  add(x: number, y: number, now: number): void {
    this.x[this.next] = x;
    this.y[this.next] = y;
    this.born[this.next] = now;
    this.next = (this.next + 1) % MAX_RIPPLES;
  }

  /**
   * Writes the combined ripple displacement for each pin into `out`.
   * Returns false (and leaves `out` alone) when nothing is rippling.
   */
  apply(out: Float32Array, px: Float32Array, py: Float32Array, now: number): boolean {
    let live = false;
    for (let r = 0; r < MAX_RIPPLES; r++) if (now - this.born[r] < RIPPLE_LIFETIME) live = true;
    if (!live) return false;

    out.fill(0);
    const k = (Math.PI * 2) / RIPPLE_WAVELENGTH;
    const inv2Sigma2 = 1 / (2 * RIPPLE_WIDTH * RIPPLE_WIDTH);
    const reach = RIPPLE_WIDTH * 3;
    for (let r = 0; r < MAX_RIPPLES; r++) {
      const age = now - this.born[r];
      if (age < 0 || age >= RIPPLE_LIFETIME) continue;
      const fade = 1 - age / RIPPLE_LIFETIME;
      const amplitude = RIPPLE_HEIGHT * fade * fade;
      const front = RIPPLE_SPEED * age;
      const inner = Math.max(0, front - reach);
      const inner2 = inner * inner;
      const outer2 = (front + reach) * (front + reach);
      const cx = this.x[r];
      const cy = this.y[r];
      for (let i = 0; i < out.length; i++) {
        const dx = px[i] - cx;
        const dy = py[i] - cy;
        const d2 = dx * dx + dy * dy;
        // Only pins inside the travelling ring are touched.
        if (d2 < inner2 || d2 > outer2) continue;
        const s = Math.sqrt(d2) - front;
        out[i] += amplitude * Math.exp(-s * s * inv2Sigma2) * Math.cos(k * s);
      }
    }
    return true;
  }
}

// ─── Idle breathing ────────────────────────────────────────────────────────

/** Noise features per world unit, and how fast the field drifts. */
const BREATH_SCALE = 0.3;
const BREATH_SPEED = 0.12;
/** Peak height of the breathing, as a share of full pin travel. */
const BREATH_LEVEL = 0.85;
/** Noise is sampled every STEP pins and interpolated: it's smooth, so this is invisible and 16× cheaper. */
const STEP = 4;
/** Seconds without a face before the board starts breathing, and how quickly it blends in/out. */
const IDLE_AFTER = 1.5;
const IDLE_BLEND_RATE = 0.9;

/** A slowly breathing heightfield from two octaves of 3D simplex noise. */
export class Breath {
  values = new Float32Array(0);
  private readonly noise = createNoise3D();
  private coarse = new Float32Array(0);
  private cols = 0;
  private rows = 0;
  private coarseCols = 0;
  private coarseRows = 0;
  private pitchX = 1;
  private pitchY = 1;

  resize(cols: number, rows: number, pitchX: number, pitchY: number): void {
    this.cols = cols;
    this.rows = rows;
    this.pitchX = pitchX;
    this.pitchY = pitchY;
    this.coarseCols = Math.ceil((cols - 1) / STEP) + 1;
    this.coarseRows = Math.ceil((rows - 1) / STEP) + 1;
    this.coarse = new Float32Array(this.coarseCols * this.coarseRows);
    this.values = new Float32Array(cols * rows);
  }

  /** Fills `values` (0..1 per pin) for time `t` in seconds. */
  update(t: number): Float32Array {
    const { coarse, coarseCols, coarseRows, cols, rows, values, noise } = this;
    const z = t * BREATH_SPEED;
    for (let cr = 0; cr < coarseRows; cr++) {
      const y = (cr * STEP - rows / 2) * this.pitchY * BREATH_SCALE;
      for (let cc = 0; cc < coarseCols; cc++) {
        const x = (cc * STEP - cols / 2) * this.pitchX * BREATH_SCALE;
        const n = 0.7 * noise(x, y, z) + 0.3 * noise(x * 2.1 + 17, y * 2.1 - 9, z * 1.6);
        // Push the noise apart into distinct swells and hollows, steep enough to catch the raking light.
        const v = Math.min(1, Math.max(0, 0.5 + 0.95 * n));
        coarse[cr * coarseCols + cc] = v * v * (3 - 2 * v) * BREATH_LEVEL;
      }
    }

    for (let r = 0; r < rows; r++) {
      const fr = r / STEP;
      const r0 = Math.min(Math.floor(fr), coarseRows - 2);
      const ty = fr - r0;
      for (let c = 0; c < cols; c++) {
        const fc = c / STEP;
        const c0 = Math.min(Math.floor(fc), coarseCols - 2);
        const tx = fc - c0;
        const i00 = r0 * coarseCols + c0;
        const top = coarse[i00] + (coarse[i00 + 1] - coarse[i00]) * tx;
        const bottom = coarse[i00 + coarseCols] + (coarse[i00 + coarseCols + 1] - coarse[i00 + coarseCols]) * tx;
        values[r * cols + c] = top + (bottom - top) * ty;
      }
    }
    return values;
  }
}

/** Decides how "idle" the board is: fades to 1 after a while with nobody in frame, back to 0 when they return. */
export class Idle {
  blend = 0;
  private lastSeen = 0;

  update(now: number, dt: number, present: boolean, enabled: boolean): number {
    if (present || !enabled) this.lastSeen = now;
    const want = now - this.lastSeen > IDLE_AFTER ? 1 : 0;
    this.blend += (want - this.blend) * (1 - Math.exp(-dt * IDLE_BLEND_RATE * 2));
    if (Math.abs(want - this.blend) < 1e-3) this.blend = want;
    return this.blend;
  }
}
