// Emberwick — the score.
// Four buses: ambience, effects, music, and a shared stairwell reverb.
// The music bus is deliberately pulled DOWN at 36.5s and again at 50.0s, so
// the two emotional beats are carried by silence, rain and fire instead.

import * as E from './engine.mjs';
import {T} from '../src/timing.mjs';

// F major pentatonic — every interval in the film is consonant by construction.
const N = {
  F2: 87.31, F3: 174.61, G3: 196.0, A3: 220.0, C4: 261.63, D4: 293.66,
  F4: 349.23, G4: 392.0, A4: 440.0, C5: 523.25, D5: 587.33,
  F5: 698.46, G5: 783.99, A5: 880.0, C6: 1046.5,
};

export function buildScore(ctx) {
  const noise = E.noiseBuffer(ctx, 8, 1);
  const pink = E.pinkBuffer(ctx, 8, 7);

  // ── Buses ────────────────────────────────────────────────────────────────
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 24;
  comp.ratio.value = 2.6;
  comp.attack.value = 0.01;
  comp.release.value = 0.28;
  master.connect(comp).connect(ctx.destination);

  const rev = ctx.createConvolver();
  rev.buffer = E.stairwellIR(ctx, 2.2, 42);
  const revOut = ctx.createGain();
  revOut.gain.value = 0.85;
  rev.connect(revOut).connect(master);

  const bus = (dry, send) => {
    const g = ctx.createGain();
    g.gain.value = dry;
    g.connect(master);
    const s = ctx.createGain();
    s.gain.value = send;
    g.connect(s).connect(rev);
    return g;
  };

  const amb = bus(1, 0.05);
  const fx = bus(1, 0.3);
  const mus = bus(1, 0.22);

  // ── Ambience: rain on wet stone ──────────────────────────────────────────
  // A bright sheet and a low roar, with a slow gust LFO riding the top layer.
  const rainTone = ctx.createBiquadFilter();
  rainTone.type = 'lowpass';
  rainTone.frequency.setValueAtTime(9000, 0);
  rainTone.Q.value = 0.5;
  rainTone.connect(amb);

  const sheet = ctx.createBufferSource();
  sheet.buffer = pink;
  sheet.loop = true;
  const sheetHP = E.band(ctx, 'highpass', 850, 0.7);
  const sheetBP = E.band(ctx, 'bandpass', 2700, 0.5);
  const sheetG = ctx.createGain();
  sheetG.gain.setValueAtTime(0.5, 0);
  sheet.connect(sheetHP).connect(sheetBP).connect(sheetG).connect(rainTone);
  sheet.start(0);

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.085;
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.value = 0.16;
  lfo.connect(lfoAmt).connect(sheetG.gain);
  lfo.start(0);

  const roar = ctx.createBufferSource();
  roar.buffer = pink;
  roar.loop = true;
  roar.playbackRate.value = 0.73;
  const roarLP = E.band(ctx, 'lowpass', 480, 0.6);
  const roarG = ctx.createGain();
  roarG.gain.value = 0.34;
  roar.connect(roarLP).connect(roarG).connect(rainTone);
  roar.start(0);

  const night = ctx.createBufferSource();
  night.buffer = pink;
  night.loop = true;
  night.playbackRate.value = 0.41;
  const nightLP = E.band(ctx, 'lowpass', 95, 0.7);
  const nightG = ctx.createGain();
  nightG.gain.value = 0.3;
  night.connect(nightLP).connect(nightG).connect(amb);
  night.start(0);

  // ── Bus automation: this is the mix ──────────────────────────────────────
  const a = amb.gain;
  a.setValueAtTime(0, 0);
  a.linearRampToValueAtTime(0.95, 4.0);                 // rain arrives with the picture
  a.setValueAtTime(0.95, 35.8);
  a.linearRampToValueAtTime(0.48, T.decision.in + 1.0); // Pip thinks — world recedes
  a.setValueAtTime(0.48, 43.4);
  a.linearRampToValueAtTime(0.30, T.gift.in + 1.0);     // the gift — near silence
  a.setValueAtTime(0.30, 49.4);
  a.linearRampToValueAtTime(0.42, 51.2);
  a.setValueAtTime(0.42, 57.8);
  a.linearRampToValueAtTime(0.74, 60.5);
  a.linearRampToValueAtTime(0.88, 62.5);                // rain returns, but warm
  a.setValueAtTime(0.88, 70.2);
  a.linearRampToValueAtTime(0.0, 73.0);
  rainTone.frequency.setValueAtTime(9000, 59.0);
  rainTone.frequency.linearRampToValueAtTime(5000, 63.0); // top rolled off = warmth

  const m = mus.gain;
  m.setValueAtTime(0, T.problem.in - 0.3);
  m.linearRampToValueAtTime(0.55, T.problem.in + 1.0);
  m.linearRampToValueAtTime(0.70, 27.5);
  m.setValueAtTime(0.70, 36.2);
  m.linearRampToValueAtTime(0.40, 37.4);                // thin out for the decision
  m.setValueAtTime(0.40, 43.7);
  m.linearRampToValueAtTime(0.62, 45.0);
  m.setValueAtTime(0.62, 49.7);
  m.linearRampToValueAtTime(0.28, 51.4);                // DUCK — the climax is fire, not music
  m.setValueAtTime(0.28, 58.6);
  m.linearRampToValueAtTime(0.78, 61.6);
  m.setValueAtTime(0.78, 70.6);
  m.linearRampToValueAtTime(0.0, 73.0);

  const f = fx.gain;
  f.setValueAtTime(0.95, 0);
  f.setValueAtTime(0.95, 43.6);
  f.linearRampToValueAtTime(0.72, 44.8);
  f.setValueAtTime(0.72, 49.6);
  f.linearRampToValueAtTime(0.98, 51.0);
  f.setValueAtTime(0.98, 70.4);
  f.linearRampToValueAtTime(0.0, 73.0);

  // ── Scene 1 · the drowned stair ──────────────────────────────────────────
  E.drip(ctx, 2.85, {freq: 1250, peak: 0.26, pan: -0.5}).connect(fx);
  E.drip(ctx, 6.15, {freq: 980, peak: 0.2, pan: 0.42}).connect(fx);
  E.drip(ctx, 9.0, {freq: 1420, peak: 0.16, pan: -0.18}).connect(fx);
  E.gust(ctx, noise, 5.2, {dur: 3.6, peak: 0.13}).connect(fx);

  // ── Scene 2 · two keepers climbing ───────────────────────────────────────
  // Brack is heavy and even; Pip is twice as fast and half the weight.
  for (let i = 0; i < 8; i++) {
    const t = 10.4 + i * 0.62;
    E.footstep(ctx, noise, t, {weight: 1, peak: 0.3, pan: -0.34 + i * 0.038}).connect(fx);
  }
  E.footstep(ctx, noise, 15.25, {weight: 1, peak: 0.19, pan: -0.02}).connect(fx);
  for (let i = 0; i < 15; i++) {
    const t = 10.56 + i * 0.31;
    E.footstep(ctx, noise, t, {weight: 0.05, peak: 0.16, pan: -0.42 + i * 0.026}).connect(fx);
  }
  E.cloth(ctx, noise, 15.6, {dur: 0.7, peak: 0.08}).connect(fx);
  E.drip(ctx, 17.4, {freq: 1120, peak: 0.15, pan: 0.3}).connect(fx);

  // ── Scene 3 · the wick is wet ────────────────────────────────────────────
  E.creak(ctx, 19.55, {dur: 0.85, peak: 0.13, base: 185}).connect(fx);
  E.drip(ctx, 21.65, {freq: 900, peak: 0.34, pan: 0}).connect(fx);   // the bad news
  E.musicBox(ctx, noise, 19.3, N.C5, {peak: 0.2, decay: 2.6}).connect(mus);
  E.musicBox(ctx, noise, 20.7, N.A4, {peak: 0.18, decay: 2.6}).connect(mus);
  E.musicBox(ctx, noise, 22.1, N.F4, {peak: 0.2, decay: 3.2}).connect(mus);
  E.pad(ctx, 21.8, N.F3, {peak: 0.075, attack: 2.0, dur: 3.4, release: 2.6}).connect(mus);
  E.drip(ctx, 24.3, {freq: 1300, peak: 0.13, pan: -0.36}).connect(fx);

  // ── Scene 4 · one match ──────────────────────────────────────────────────
  E.tinClick(ctx, noise, 26.95, {peak: 0.28}).connect(fx);
  E.tinClick(ctx, noise, 27.5, {peak: 0.2}).connect(fx);
  E.matchStrike(ctx, noise, 29.15, {peak: 0.44}).connect(fx);
  E.crackle(ctx, noise, 29.6, {dur: 6.9, density: 5, peak: 0.055, seed: 3, tail: 1}).connect(fx);
  E.wickSpit(ctx, noise, 31.0, {dur: 1.7, peak: 0.32, seed: 21}).connect(fx);
  E.wickSpit(ctx, noise, 33.25, {dur: 1.35, peak: 0.27, seed: 34}).connect(fx);
  E.gust(ctx, noise, 34.0, {dur: 2.4, peak: 0.24}).connect(fx);

  // A pulse under the second half: the match burning down. Felt, not heard.
  const pulses = [31.5, 32.05, 32.6, 33.1, 33.55, 33.95, 34.3, 34.62, 34.9, 35.15, 35.37, 35.57, 35.75, 35.92, 36.08, 36.22];
  for (let i = 0; i < pulses.length; i++) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(74, pulses[i]);
    o.frequency.exponentialRampToValueAtTime(48, pulses[i] + 0.1);
    o.connect(E.hit(ctx, pulses[i], 0.05 + i * 0.0035, 0.008, 0.14)).connect(fx);
    o.start(pulses[i]);
    o.stop(pulses[i] + 0.35);
  }

  const motifA = [[26.5, N.A4], [27.3, N.C5], [28.1, N.D5], [28.9, N.C5]];
  const motifB = [[30.4, N.C5], [31.2, N.D5], [32.0, N.F5], [32.8, N.D5]];
  const motifC = [[34.0, N.D5], [34.6, N.F5], [35.2, N.G5], [35.8, N.F5]];
  for (const [t, n] of [...motifA, ...motifB, ...motifC]) {
    E.musicBox(ctx, noise, t, n, {peak: 0.17, decay: 1.9}).connect(mus);
  }
  E.pad(ctx, 26.2, N.F3, {peak: 0.08, attack: 2.2, dur: 6.2, release: 2.2}).connect(mus);

  // ── Scene 5 · Pip decides ────────────────────────────────────────────────
  // One held note, and then a room with almost nothing in it.
  E.musicBox(ctx, noise, 36.6, N.F4, {peak: 0.26, decay: 5.5}).connect(mus);
  E.crackle(ctx, noise, 36.5, {dur: 7.5, density: 4, peak: 0.04, seed: 8, tail: 0.8}).connect(fx);
  E.musicBox(ctx, noise, 40.1, N.C4, {peak: 0.2, decay: 4.6}).connect(mus);
  E.drip(ctx, 38.6, {freq: 1050, peak: 0.13, pan: 0.45}).connect(fx);
  E.pluck(ctx, noise, 42.45, {peak: 0.24}).connect(fx);              // the tuft comes free

  // ── Scene 6 · the tuft ───────────────────────────────────────────────────
  E.cloth(ctx, noise, 44.75, {dur: 0.75, peak: 0.1}).connect(fx);
  for (const [t, n] of [[44.3, N.F3], [45.2, N.A3], [46.1, N.C4], [47.2, N.D4]]) {
    E.musicBox(ctx, noise, t, n, {peak: 0.22, decay: 3.4}).connect(mus);
  }
  E.pad(ctx, 44.0, N.F3, {peak: 0.085, attack: 2.4, dur: 2.6, release: 2.4}).connect(mus);
  E.crackle(ctx, noise, 44.0, {dur: 6.2, density: 4, peak: 0.035, seed: 15, tail: 0.7}).connect(fx);
  E.cloth(ctx, noise, 48.6, {dur: 0.6, peak: 0.09}).connect(fx);     // Brack takes it

  // ── Scene 7 · it catches ─────────────────────────────────────────────────
  E.catchFlame(ctx, noise, 50.85, {peak: 0.36}).connect(fx);
  E.crackle(ctx, noise, 51.0, {dur: 10.4, density: 17, peak: 0.155, seed: 27, tail: 0.72}).connect(fx);
  E.pad(ctx, 50.2, N.F2, {peak: 0.1, attack: 3.0, dur: 5.0, release: 3.4, cutoff: 420}).connect(mus);
  E.musicBox(ctx, noise, 50.7, N.F5, {peak: 0.14, decay: 4.5}).connect(mus);
  E.musicBox(ctx, noise, 56.2, N.C5, {peak: 0.13, decay: 5.0}).connect(mus);

  // ── Scene 8 · Emberwick ──────────────────────────────────────────────────
  E.bell(ctx, 61.25, {freq: N.D5, peak: 0.22, decay: 6}).connect(fx);
  E.crackle(ctx, noise, 61.0, {dur: 11.5, density: 8, peak: 0.075, seed: 61, tail: 0.85}).connect(fx);
  E.cloth(ctx, noise, 63.05, {dur: 0.9, peak: 0.13}).connect(fx);    // the collar unwinds
  E.cloth(ctx, noise, 64.4, {dur: 0.7, peak: 0.1}).connect(fx);      // and settles
  E.pad(ctx, 61.0, N.F3, {peak: 0.105, attack: 2.6, dur: 6.0, release: 3.4, cutoff: 700}).connect(mus);

  const resolve = [[61.7, N.F4, N.F5], [62.6, N.G4, N.G5], [63.5, N.A4, N.A5], [64.7, N.C5, N.C6]];
  for (const [t, lo, hi] of resolve) {
    E.musicBox(ctx, noise, t, lo, {peak: 0.21, decay: 3.2}).connect(mus);
    E.musicBox(ctx, noise, t, hi, {peak: 0.1, decay: 2.6}).connect(mus);
  }
  for (const [t, n, d] of [[66.1, N.D5, 3.4], [67.5, N.C5, 3.6], [68.9, N.A4, 4.0], [70.3, N.F4, 5.2]]) {
    E.musicBox(ctx, noise, t, n, {peak: 0.2, decay: d}).connect(mus);
  }
  E.bell(ctx, 70.6, {freq: N.F5, peak: 0.13, decay: 6}).connect(fx);
  E.drip(ctx, 68.2, {freq: 1180, peak: 0.12, pan: -0.4}).connect(fx);

  return {master};
}
