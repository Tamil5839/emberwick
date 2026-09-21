import {C} from '../lib/palette';
import {Flame} from './Flame';

/** The last match. Held at an angle, burning down toward the fingers. */
export const Match: React.FC<{
  x: number;
  y: number;
  f: number;
  angle?: number;
  /** 1 fresh, 0 gone. Shortens the stick and chars what is left. */
  burn?: number;
  /** 0 out, 1 burning strongly. */
  flame?: number;
  /** 0 guttering, 1 burning cleanly. */
  steady?: number;
  scale?: number;
}> = ({x, y, f, angle = -34, burn = 1, flame = 1, steady, scale = 1}) => {
  const len = 30 * burn + 8;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
      <rect x={-1.4} y={-len} width={2.8} height={len} rx={1.3} fill="#6E5B43" />
      <rect x={-1.4} y={-len} width={2.8} height={Math.min(len, 7 + (1 - burn) * 10)} rx={1.3} fill="#1A1410" />
      {flame > 0.02 ? <Flame x={0} y={-len} size={7 + flame * 4} f={f} seed={7} opacity={flame} steady={steady ?? flame} /> : null}
    </g>
  );
};

/** The tin the match came out of. */
export const Tin: React.FC<{x: number; y: number; open?: number; scale?: number; angle?: number}> = ({
  x,
  y,
  open = 0,
  scale = 1,
  angle = 0,
}) => (
  <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
    <rect x={-13} y={-7} width={26} height={14} rx={2.5} fill="#3D3A33" />
    <rect x={-13} y={-7} width={26} height={3} rx={1.5} fill="#55504594" />
    <g transform={`translate(-13 -7) scale(1 ${1 - open * 0.92}) translate(13 7)`}>
      <rect x={-13} y={-14} width={26} height={8} rx={2} fill="#4A463D" />
    </g>
    {open > 0.3 ? <rect x={-11} y={-6} width={22} height={4} rx={2} fill={C.black} opacity={0.7} /> : null}
  </g>
);

/** A single drop leaving the wick. The film's smallest piece of bad news. */
export const Droplet: React.FC<{x: number; y: number; t: number; fall: number}> = ({x, y, t, fall}) => {
  if (t < 0 || t > 1) return null;
  const k = t * t;
  const s = 1 + t * 0.5;
  return (
    <g transform={`translate(${x} ${y + k * fall})`} opacity={1 - Math.max(0, (t - 0.85) / 0.15)}>
      <path d={`M 0 ${-5 * s} q ${3.4 * s} ${4 * s} 0 ${8 * s} q ${-3.4 * s} ${-4 * s} 0 ${-8 * s} z`} fill={C.stoneEdge} opacity={0.8} />
      <circle cx={-1} cy={1} r={1.1} fill={C.catchCool} opacity={0.6} />
    </g>
  );
};

/** A wet wick spitting rather than catching. Small, bright, and hopeless. */
export const Sparks: React.FC<{x: number; y: number; f: number; amount: number; seed?: number}> = ({
  x,
  y,
  f,
  amount,
  seed = 1,
}) => {
  if (amount <= 0.02) return null;
  const items = [];
  for (let i = 0; i < 12; i++) {
    const cycle = 11 + ((i * 7 + seed) % 9);
    const t = ((f + i * 5 + seed * 3) % cycle) / cycle;
    if (t > 0.7) continue;
    const k = t / 0.7;
    const a = (i / 12) * Math.PI * 2 + seed;
    const d = k * (14 + (i % 5) * 7);
    items.push(
      <circle
        key={i}
        cx={x + Math.cos(a) * d}
        cy={y - Math.abs(Math.sin(a)) * d * 0.8 + k * k * 12}
        r={(1 - k) * 1.8 + 0.3}
        fill={i % 3 ? '#FFD79A' : '#FF9A3C'}
        opacity={(1 - k) * amount}
      />
    );
  }
  return <g style={{mixBlendMode: 'screen'}}>{items}</g>;
};

/** Steam coming off a wick that is losing an argument with the rain. */
export const Steam: React.FC<{x: number; y: number; f: number; amount: number}> = ({x, y, f, amount}) => {
  if (amount <= 0.02) return null;
  const puffs = [];
  for (let i = 0; i < 5; i++) {
    const cycle = 46;
    const t = ((f + i * 11) % cycle) / cycle;
    puffs.push(
      <ellipse
        key={i}
        cx={x + Math.sin(t * 4 + i) * 9}
        cy={y - t * 46}
        rx={4 + t * 15}
        ry={3 + t * 11}
        fill={C.fog}
        opacity={(1 - t) * 0.22 * amount}
      />
    );
  }
  return <g>{puffs}</g>;
};
