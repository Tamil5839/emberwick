// Renders the whole soundtrack offline through the Web Audio API and writes
// a 24-bit WAV that Remotion mounts as the film's single audio track.

import {OfflineAudioContext} from 'node-web-audio-api';
import {writeFileSync, mkdirSync} from 'node:fs';
import {buildScore} from '../audio/score.mjs';
import {DURATION_IN_FRAMES, FPS} from '../src/timing.mjs';

const SAMPLE_RATE = 48000;
const SECONDS = DURATION_IN_FRAMES / FPS;
const OUT = new URL('../public/emberwick-mix.wav', import.meta.url);

function encodeWav24(buffer) {
  const ch = buffer.numberOfChannels;
  const n = buffer.length;
  const bytes = n * ch * 3;
  const out = Buffer.alloc(44 + bytes);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + bytes, 4);
  out.write('WAVE', 8);
  out.write('fmt ', 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(ch, 22);
  out.writeUInt32LE(buffer.sampleRate, 24);
  out.writeUInt32LE(buffer.sampleRate * ch * 3, 28);
  out.writeUInt16LE(ch * 3, 32);
  out.writeUInt16LE(24, 34);
  out.write('data', 36);
  out.writeUInt32LE(bytes, 40);

  const data = [];
  for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c));
  let p = 44;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      let s = data[c][i];
      if (Math.abs(s) > peak) peak = Math.abs(s);
      s = Math.max(-1, Math.min(1, s));
      const v = Math.round(s * 8388607);
      out.writeIntLE(v, p, 3);
      p += 3;
    }
  }
  return {out, peak};
}

console.log(`Emberwick · rendering ${SECONDS.toFixed(1)}s of audio at ${SAMPLE_RATE}Hz…`);
const ctx = new OfflineAudioContext(2, Math.ceil(SECONDS * SAMPLE_RATE), SAMPLE_RATE);
buildScore(ctx);
const rendered = await ctx.startRendering();

// A gentle safety trim so the master never clips the 24-bit ceiling.
const peakBefore = (() => {
  let p = 0;
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    const d = rendered.getChannelData(c);
    for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > p) p = Math.abs(d[i]);
  }
  return p;
})();
if (peakBefore > 0.97) {
  const g = 0.97 / peakBefore;
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    const d = rendered.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= g;
  }
  console.log(`  normalised by ${g.toFixed(3)} (peak was ${peakBefore.toFixed(3)})`);
}

const {out, peak} = encodeWav24(rendered);
mkdirSync(new URL('../public/', import.meta.url), {recursive: true});
writeFileSync(OUT, out);
console.log(`  peak ${peak.toFixed(3)} · ${(out.length / 1e6).toFixed(1)} MB → public/emberwick-mix.wav`);
