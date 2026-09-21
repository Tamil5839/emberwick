// Small deterministic maths library. Every value in the film is a pure
// function of the frame number, so any frame can be rendered in isolation.

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inv = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
export const TAU = Math.PI * 2;
export const rad = (deg: number) => (deg * Math.PI) / 180;

/** Cubic-bezier solver, so the canon's easing curves are used literally. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    const p = clamp(x);
    let t = p;
    for (let i = 0; i < 6; i++) {
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (sampleX(t) - p) / d;
    }
    return sampleY(clamp(t));
  };
}

export const EASE = {
  out: bezier(0.16, 1, 0.3, 1),
  inOut: bezier(0.65, 0, 0.35, 1),
  in: bezier(0.7, 0, 0.84, 0),
  linear: (t: number) => clamp(t),
  soft: bezier(0.4, 0, 0.2, 1),
};

export type Ease = (t: number) => number;

/** Map a frame window onto a value range with an easing curve. */
export function seg(f: number, f0: number, f1: number, v0: number, v1: number, ease: Ease = EASE.inOut) {
  return lerp(v0, v1, ease(inv(f0, f1, f)));
}

/** Keyframe track: [[frame, value], ...]. Holds before the first and after the last. */
export function kf(f: number, keys: [number, number][], ease: Ease = EASE.inOut): number {
  if (keys.length === 0) return 0;
  if (f <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (f >= last[0]) return last[1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [fa, va] = keys[i];
    const [fb, vb] = keys[i + 1];
    if (f >= fa && f <= fb) return lerp(va, vb, ease(inv(fa, fb, f)));
  }
  return last[1];
}

/** Seeded PRNG — identical output on every machine and every render. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(n: number, seed = 1) {
  let t = (n + seed * 0x9e3779b9) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
  t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 1-D value noise — used for flame flicker and fog drift. */
export function noise1(x: number, seed = 1) {
  const i = Math.floor(x);
  const t = smoothstep(x - i);
  return lerp(hash(i, seed), hash(i + 1, seed), t) * 2 - 1;
}

/** Layered value noise. Organic drift without any randomness at render time. */
export function fbm(x: number, seed = 1, octaves = 3) {
  let v = 0;
  let amp = 0.5;
  let fr = 1;
  for (let i = 0; i < octaves; i++) {
    v += noise1(x * fr, seed + i * 71) * amp;
    amp *= 0.5;
    fr *= 2.07;
  }
  return v;
}

/** A blink: closed at `at`, open again `dur` frames later. */
export function blinkAt(f: number, at: number, dur = 4) {
  const d = f - at;
  if (d < 0 || d > dur) return 0;
  const t = d / dur;
  return Math.sin(t * Math.PI) ** 0.7;
}

/** Combined blink track for a character across a scene. */
export function blinks(f: number, times: number[], dur = 4) {
  let v = 0;
  for (const t of times) v = Math.max(v, blinkAt(f, t, dur));
  return v;
}
