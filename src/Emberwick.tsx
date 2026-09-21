// The film. Eight shots, four dissolves, one match cut, and one camera move
// that crosses a scene boundary without a cut at all.

import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {EASE, clamp, inv} from './lib/math';
import {SCENES} from './timing.mjs';
import {S1} from './scenes/S1';
import {S2} from './scenes/S2';
import {S3} from './scenes/S3';
import {S4} from './scenes/S4';
import {S5} from './scenes/S5';
import {S6} from './scenes/S6';
import {S7} from './scenes/S7';
import {S8} from './scenes/S8';

/** Set true for three minimal caption cards. The film is built to play silent
 *  and wordless; this exists only because the brief asked for the option. */
const CAPTIONS = false;

type Shot = {
  C: React.FC<{f: number}>;
  start: number;
  end: number;
  /** Cross-dissolve length in frames, centred on the cut. 0 is a straight cut. */
  inD: number;
  outD: number;
};

const D = 18;
const D2 = 16;

const SHOTS: Shot[] = [
  {C: S1, start: SCENES[0].start, end: SCENES[1].start, inD: 0, outD: D},
  {C: S2, start: SCENES[1].start, end: SCENES[2].start, inD: D, outD: 0},
  {C: S3, start: SCENES[2].start, end: SCENES[3].start, inD: 0, outD: 0},
  {C: S4, start: SCENES[3].start, end: SCENES[4].start, inD: 0, outD: D2},
  {C: S5, start: SCENES[4].start, end: SCENES[5].start, inD: D2, outD: 0},
  {C: S6, start: SCENES[5].start, end: SCENES[6].start, inD: 0, outD: 0},
  {C: S7, start: SCENES[6].start, end: SCENES[7].start, inD: 0, outD: 0},
  {C: S8, start: SCENES[7].start, end: SCENES[7].start + SCENES[7].dur, inD: 0, outD: 0},
];

export const Emberwick: React.FC = () => {
  const f = useCurrentFrame();
  const last = SHOTS[SHOTS.length - 1].end;

  const toBlack = Math.max(1 - EASE.inOut(inv(0, 26, f)), EASE.inOut(inv(last - 36, last, f)));

  return (
    <AbsoluteFill style={{backgroundColor: '#04080C'}}>
      <Audio src={staticFile('emberwick-mix.wav')} />

      {SHOTS.map(({C, start, end, inD, outD}, i) => {
        const from = start - inD / 2;
        const to = end + outD / 2;
        if (f < from || f >= to) return null;
        const rampIn = inD > 0 ? EASE.inOut(inv(from, start + inD / 2, f)) : 1;
        const rampOut = outD > 0 ? 1 - EASE.inOut(inv(end - outD / 2, to, f)) : 1;
        return (
          <AbsoluteFill key={i} style={{opacity: clamp(Math.min(rampIn, rampOut))}}>
            <C f={f} />
          </AbsoluteFill>
        );
      })}

      <Title f={f} />
      {CAPTIONS ? <Captions f={f} /> : null}

      <AbsoluteFill style={{backgroundColor: '#000', opacity: clamp(toBlack), pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

const Title: React.FC<{f: number}> = ({f}) => {
  const o = Math.min(EASE.inOut(inv(40, 74, f)), 1 - EASE.inOut(inv(132, 168, f)));
  if (o <= 0.01) return null;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 148}}>
      <div
        style={{
          fontFamily: '-apple-system, "Helvetica Neue", Arial, sans-serif',
          fontSize: 21,
          letterSpacing: '0.46em',
          textIndent: '0.46em',
          fontWeight: 400,
          color: '#A9BAC6',
          opacity: clamp(o) * 0.8,
        }}
      >
        EMBERWICK
      </div>
    </AbsoluteFill>
  );
};

const LINES: [number, number, string][] = [
  [470, 600, 'The wick had been wet for days.'],
  [900, 1030, 'Pip had one dry thing left.'],
  [1500, 1640, 'So did Brack.'],
];

const Captions: React.FC<{f: number}> = ({f}) => (
  <>
    {LINES.map(([a, b, text]) => {
      const o = Math.min(EASE.inOut(inv(a, a + 26, f)), 1 - EASE.inOut(inv(b - 26, b, f)));
      if (o <= 0.01) return null;
      return (
        <AbsoluteFill key={text} style={{alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 96}}>
          <div style={{fontFamily: 'Georgia, serif', fontSize: 26, color: '#C3D0D9', opacity: clamp(o) * 0.7, letterSpacing: '0.04em'}}>
            {text}
          </div>
        </AbsoluteFill>
      );
    })}
  </>
);
