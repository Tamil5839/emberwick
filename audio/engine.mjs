// Emberwick — synthesis engine.
// Every sound in this film is generated: shaped noise, oscillators, and a
// procedurally built impulse response for the stairwell. Nothing is sampled.

const TAU = Math.PI * 2;

/** Deterministic PRNG so every render of the mix is bit-identical. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Source buffers ──────────────────────────────────────────────────────────

/** White noise, looped as the bed for rain, wind, hiss and transients. */
export function noiseBuffer(ctx, seconds = 8, seed = 1) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const r = rng(seed + ch * 977);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    // Cross-fade the seam so the loop never ticks.
    const f = Math.floor(ctx.sampleRate * 0.25);
    for (let i = 0; i < f; i++) {
      const k = i / f;
      d[i] = d[i] * k + d[n - f + i] * (1 - k);
    }
  }
  return buf;
}

/** Pink-ish noise (Voss-McCartney style) — rain needs the low tilt. */
export function pinkBuffer(ctx, seconds = 8, seed = 7) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const r = rng(seed + ch * 313);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = r() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
    }
    const f = Math.floor(ctx.sampleRate * 0.25);
    for (let i = 0; i < f; i++) {
      const k = i / f;
      d[i] = d[i] * k + d[n - f + i] * (1 - k);
    }
  }
  return buf;
}

/**
 * Impulse response for the stairwell: exponentially decaying noise, darkened
 * by a one-pole lowpass and decorrelated between channels so it opens up.
 */
export function stairwellIR(ctx, seconds = 2.2, seed = 42) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const r = rng(seed + ch * 4099);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const env = Math.pow(1 - t, 2.6) * Math.exp(-t * 2.2);
      lp += ((r() * 2 - 1) - lp) * 0.22; // dark, stone-like tail
      d[i] = lp * env;
    }
    // A couple of early reflections give the stair its size.
    for (const [ms, g] of [[11, 0.5], [23, 0.34], [37, 0.22]]) {
      const k = Math.floor((ms / 1000) * ctx.sampleRate) + ch * 13;
      if (k < n) d[k] += g * (r() > 0.5 ? 1 : -1);
    }
  }
  return buf;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const EPS = 0.0001;

/** Percussive envelope: near-instant attack, exponential fall. */
export function hit(ctx, t, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, EPS), t + attack);
  g.gain.exponentialRampToValueAtTime(EPS, t + attack + decay);
  g.gain.setValueAtTime(0, t + attack + decay + 0.001);
  return g;
}

/** Swell envelope: something arriving and leaving. */
export function swell(ctx, t, peak, attack, hold, release) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.linearRampToValueAtTime(0, t + attack + hold + release);
  return g;
}

function band(ctx, type, freq, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}
export {band};

/** A burst of filtered noise — the workhorse behind most of the effects. */
export function noiseBurst(ctx, src, t, opts) {
  const {
    peak = 0.3, attack = 0.002, decay = 0.15,
    type = 'bandpass', freq = 1200, q = 1,
    sweepTo = null, sweepTime = null, pan = 0,
  } = opts;
  const s = ctx.createBufferSource();
  s.buffer = src;
  s.loop = true;
  s.playbackRate.value = 0.8 + (freq % 97) / 400;
  const f = band(ctx, type, freq, q);
  if (sweepTo !== null) {
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(sweepTo, t + (sweepTime ?? decay));
  }
  const g = hit(ctx, t, peak, attack, decay);
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  s.connect(f).connect(g).connect(p);
  s.start(t);
  s.stop(t + attack + decay + 0.05);
  return p;
}

// ── Voices ──────────────────────────────────────────────────────────────────

/** A water drop: a sine whose pitch falls away fast. Stone makes it ring. */
export function drip(ctx, t, {freq = 1200, peak = 0.22, pan = 0} = {}) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.32, t + 0.07);
  const g = hit(ctx, t, peak, 0.001, 0.13);
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  o.connect(g).connect(p);
  o.start(t);
  o.stop(t + 0.2);
  return p;
}

/**
 * A footstep in standing water: a body thump plus a bright splash.
 * `weight` 1 is Brack (heavy, low); 0 is Pip (light, quick, high).
 */
export function footstep(ctx, noise, t, {weight = 1, peak = 0.3, pan = 0} = {}) {
  const out = ctx.createGain();
  out.gain.value = 1;

  const thumpF = 62 + (1 - weight) * 120;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(thumpF * 1.7, t);
  o.frequency.exponentialRampToValueAtTime(thumpF, t + 0.045);
  o.connect(hit(ctx, t, peak * (0.35 + 0.65 * weight), 0.003, 0.09 + 0.07 * weight)).connect(out);
  o.start(t);
  o.stop(t + 0.3);

  noiseBurst(ctx, noise, t, {
    peak: peak * 0.5,
    attack: 0.001,
    decay: 0.05 + 0.05 * weight,
    type: 'lowpass',
    freq: 900 - weight * 350,
  }).connect(out);

  // The splash: the water leaving the stone.
  noiseBurst(ctx, noise, t + 0.006, {
    peak: peak * (0.3 + 0.25 * (1 - weight)),
    attack: 0.001,
    decay: 0.075,
    type: 'highpass',
    freq: 2200 + (1 - weight) * 1800,
  }).connect(out);

  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  return out.connect(p);
}

/** Old hinge: a wobbling saw through a tight band. Short, reluctant. */
export function creak(ctx, t, {dur = 0.55, peak = 0.12, base = 190} = {}) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(base, t);
  o.frequency.linearRampToValueAtTime(base * 1.45, t + dur);
  const wob = ctx.createOscillator();
  wob.type = 'sine';
  wob.frequency.value = 17;
  const wobAmt = ctx.createGain();
  wobAmt.gain.value = base * 0.14;
  wob.connect(wobAmt).connect(o.frequency);
  wob.start(t);
  wob.stop(t + dur + 0.1);

  const f = band(ctx, 'bandpass', 1350, 9);
  const g = swell(ctx, t, peak, 0.06, dur * 0.5, dur * 0.44);
  o.connect(f).connect(g);
  o.start(t);
  o.stop(t + dur + 0.1);
  return g;
}

/** Tin lid: a click and a small metallic ping. */
export function tinClick(ctx, noise, t, {peak = 0.3} = {}) {
  const out = ctx.createGain();
  noiseBurst(ctx, noise, t, {peak, attack: 0.0005, decay: 0.018, type: 'highpass', freq: 4200}).connect(out);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = 3180;
  o.connect(hit(ctx, t + 0.002, peak * 0.3, 0.001, 0.07)).connect(out);
  o.start(t);
  o.stop(t + 0.15);
  return out;
}

/** Match: the scrape across the strip, then the head taking light. */
export function matchStrike(ctx, noise, t, {peak = 0.42} = {}) {
  const out = ctx.createGain();
  // two scrapes — the hand that isn't sure
  noiseBurst(ctx, noise, t, {peak: peak * 0.5, attack: 0.002, decay: 0.05, type: 'highpass', freq: 3400}).connect(out);
  noiseBurst(ctx, noise, t + 0.075, {peak: peak * 0.85, attack: 0.002, decay: 0.09, type: 'highpass', freq: 2800}).connect(out);
  // ignition
  noiseBurst(ctx, noise, t + 0.1, {
    peak, attack: 0.02, decay: 0.42, type: 'lowpass',
    freq: 260, sweepTo: 2000, sweepTime: 0.14,
  }).connect(out);
  return out;
}

/** A wet wick refusing a flame: a hiss with sharp spits through it. */
export function wickSpit(ctx, noise, t, {dur = 1.4, peak = 0.3, seed = 5} = {}) {
  const out = ctx.createGain();
  noiseBurst(ctx, noise, t, {
    peak: peak * 0.55, attack: 0.05, decay: dur, type: 'bandpass', freq: 2900, q: 1.4,
  }).connect(out);
  const r = rng(seed);
  for (let i = 0; i < 7; i++) {
    const st = t + 0.08 + r() * (dur - 0.2);
    noiseBurst(ctx, noise, st, {
      peak: peak * (0.5 + r() * 0.7), attack: 0.001, decay: 0.03 + r() * 0.05,
      type: 'bandpass', freq: 1800 + r() * 4000, q: 3, pan: (r() - 0.5) * 0.5,
    }).connect(out);
  }
  return out;
}

/** Wind moving through the stair. */
export function gust(ctx, noise, t, {dur = 2.4, peak = 0.3} = {}) {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  s.loop = true;
  const f = band(ctx, 'bandpass', 380, 1.6);
  f.frequency.setValueAtTime(320, t);
  f.frequency.linearRampToValueAtTime(980, t + dur * 0.45);
  f.frequency.linearRampToValueAtTime(300, t + dur);
  const g = swell(ctx, t, peak, dur * 0.4, dur * 0.1, dur * 0.5);
  s.connect(f).connect(g);
  s.start(t);
  s.stop(t + dur + 0.2);
  return g;
}

/** The flame taking hold: a soft intake, then it is simply there. */
export function catchFlame(ctx, noise, t, {peak = 0.34} = {}) {
  const out = ctx.createGain();
  noiseBurst(ctx, noise, t, {
    peak, attack: 0.09, decay: 0.75, type: 'lowpass',
    freq: 300, sweepTo: 2600, sweepTime: 0.3,
  }).connect(out);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.6);
  o.connect(hit(ctx, t, 0.12, 0.05, 0.7)).connect(out);
  o.start(t);
  o.stop(t + 1.4);
  return out;
}

/** Fire, as grains — small bright crackles thinning out over time. */
export function crackle(ctx, noise, t, {dur = 10, density = 13, peak = 0.13, seed = 11, tail = 0.5} = {}) {
  const out = ctx.createGain();
  const r = rng(seed);
  const n = Math.floor(dur * density);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const st = t + k * dur + (r() - 0.5) * 0.1;
    const fall = 1 - (1 - tail) * k;
    noiseBurst(ctx, noise, st, {
      peak: peak * (0.25 + r() * 0.75) * fall,
      attack: 0.0008,
      decay: 0.012 + r() * 0.05,
      type: 'bandpass',
      freq: 900 + r() * 3600,
      q: 2.5 + r() * 3,
      pan: (r() - 0.5) * 0.7,
    }).connect(out);
  }
  return out;
}

/** Cloth being unwound and laid over something. */
export function cloth(ctx, noise, t, {dur = 0.6, peak = 0.14} = {}) {
  return noiseBurst(ctx, noise, t, {
    peak, attack: dur * 0.35, decay: dur * 0.65, type: 'bandpass', freq: 1500, q: 0.8,
  });
}

/** Small soft pluck — moss letting go. */
export function pluck(ctx, noise, t, {peak = 0.2} = {}) {
  const out = ctx.createGain();
  noiseBurst(ctx, noise, t, {peak: peak * 0.6, attack: 0.004, decay: 0.09, type: 'bandpass', freq: 700, q: 1.2}).connect(out);
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(330, t);
  o.frequency.exponentialRampToValueAtTime(190, t + 0.18);
  o.connect(hit(ctx, t, peak * 0.5, 0.004, 0.2)).connect(out);
  o.start(t);
  o.stop(t + 0.4);
  return out;
}

/** Struck bell — inharmonic partials, each with its own decay. */
export function bell(ctx, t, {freq = 587.33, peak = 0.22, decay = 5} = {}) {
  const out = ctx.createGain();
  const partials = [[1, 1, 1], [2.0, 0.42, 0.72], [2.76, 0.3, 0.5], [3.42, 0.18, 0.36], [4.07, 0.12, 0.26], [5.43, 0.07, 0.17]];
  for (const [mult, amp, len] of partials) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    o.detune.value = (mult - 1) * 4;
    o.connect(hit(ctx, t, peak * amp, 0.004, decay * len)).connect(out);
    o.start(t);
    o.stop(t + decay * len + 0.2);
  }
  return out;
}

/** Music box: sine core, a triangle glint, and the hammer that struck it. */
export function musicBox(ctx, noise, t, freq, {peak = 0.2, decay = 2.2} = {}) {
  const out = ctx.createGain();
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  o.connect(hit(ctx, t, peak, 0.004, decay)).connect(out);
  o.start(t);
  o.stop(t + decay + 0.2);

  const o2 = ctx.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = freq * 2.004;
  o2.connect(hit(ctx, t, peak * 0.16, 0.003, decay * 0.32)).connect(out);
  o2.start(t);
  o2.stop(t + decay + 0.2);

  const o3 = ctx.createOscillator();
  o3.type = 'sine';
  o3.frequency.value = freq * 5.41;
  o3.connect(hit(ctx, t, peak * 0.05, 0.002, 0.28)).connect(out);
  o3.start(t);
  o3.stop(t + 0.5);

  if (noise) {
    noiseBurst(ctx, noise, t, {peak: peak * 0.1, attack: 0.0006, decay: 0.014, type: 'highpass', freq: 5000}).connect(out);
  }
  return out;
}

/** Warm sustained pad — two detuned saws kept under a soft lid. */
export function pad(ctx, t, freq, {peak = 0.1, attack = 1.6, dur = 6, release = 2.4, cutoff = 620} = {}) {
  const out = ctx.createGain();
  const g = swell(ctx, t, peak, attack, dur, release);
  const f = band(ctx, 'lowpass', cutoff, 0.7);
  for (const det of [-6, 6]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = det;
    o.connect(f);
    o.start(t);
    o.stop(t + attack + dur + release + 0.2);
  }
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = freq / 2;
  const subG = ctx.createGain();
  subG.gain.value = 0.5;
  sub.connect(subG).connect(f);
  sub.start(t);
  sub.stop(t + attack + dur + release + 0.2);

  f.connect(g).connect(out);
  return out;
}
