// The stair, in three layers: what is behind, what the story happens on, and
// what the lens is looking past. Each layer is drawn once and reused by every
// scene, so the world holds together across the whole film.

import {C} from '../lib/palette';
import {mix} from '../lib/color';
import {rng} from '../lib/math';
import {
  TREAD_COUNT,
  depthScale,
  haze,
  treadL,
  treadR,
  treadW,
  treadY,
} from './geometry';

// ── Background: sky, ridge, and the row of lanterns that are all dark ───────

export const SkyLayer: React.FC<{lit?: number}> = ({lit = 0}) => (
  <g>
    <rect x={-700} y={-500} width={3400} height={2200} fill="url(#sky)" />
    {/* A far ridge, almost the same value as the sky — distance eats contrast. */}
    <path
      d="M -700 620 C -200 560, 120 592, 420 548 C 700 508, 880 556, 1180 520 C 1460 488, 1700 524, 2700 470 L 2700 1600 L -700 1600 Z"
      fill={C.ridge}
      opacity={0.9}
    />
    <path
      d="M -700 700 C -260 664, 60 690, 460 648 C 900 604, 1240 640, 2700 580 L 2700 1600 L -700 1600 Z"
      fill={mix(C.ridge, C.fogDeep, 0.35)}
      opacity={0.75}
    />
    {/* The other lanterns on the stair. None of them are burning. */}
    {[7, 10, 13, 17, 21].map((d) => (
      <FarLantern key={d} d={d} lit={lit} />
    ))}
  </g>
);

const FarLantern: React.FC<{d: number; lit: number}> = ({d, lit}) => {
  const s = depthScale(d);
  const x = treadR(d) - 6 * s;
  const y = treadY(d);
  const h = 150 * s;
  const col = mix(C.stone, C.fog, haze(d) * 0.8);
  return (
    <g opacity={1 - haze(d) * 0.45}>
      <rect x={x - 2.4 * s} y={y - h} width={4.8 * s} height={h} fill={col} />
      <g transform={`translate(${x} ${y - h - 16 * s}) scale(${s})`}>
        <path d="M -13 14 L -10 -8 Q 0 -22 10 -8 L 13 14 Z" fill={col} />
        <path d="M -9 12 L -7 -5 Q 0 -16 7 -5 L 9 12 Z" fill={C.black} opacity={0.55} />
        {lit > 0.01 ? <circle cy={2} r={9} fill={C.ember} opacity={lit * 0.35} style={{mixBlendMode: 'screen'}} /> : null}
      </g>
    </g>
  );
};

// ── Midground: the stair itself ─────────────────────────────────────────────

export const StairLayer: React.FC = () => {
  const treads = [];
  for (let d = TREAD_COUNT - 1; d >= 0; d--) treads.push(<Tread key={d} d={d} />);
  return (
    <g>
      {/* the stone mass the stair is cut from */}
      <path
        d={`M ${treadL(0) - 260} 1500 L ${treadL(0) - 40} ${treadY(0)} L ${treadL(TREAD_COUNT - 1)} ${treadY(TREAD_COUNT - 1)}
            L ${treadR(TREAD_COUNT - 1)} ${treadY(TREAD_COUNT - 1)} L ${treadR(0) + 60} ${treadY(0)} L ${treadR(0) + 320} 1500 Z`}
        fill={C.slate}
      />
      {treads}
      <Parapet />
      <Balustrade />
    </g>
  );
};

const Tread: React.FC<{d: number}> = ({d}) => {
  const h = haze(d);
  const y0 = treadY(d);
  const y1 = treadY(d + 1);
  const l0 = treadL(d);
  const r0 = treadR(d);
  const l1 = treadL(d + 1);
  const r1 = treadR(d + 1);
  const s = depthScale(d);
  const base = mix(d % 2 ? C.stone : C.slate, C.fogDeep, h * 0.62);
  const edge = mix(C.stoneEdge, C.fog, h * 0.7);

  const r = rng(d * 977 + 13);
  const moss = [];
  for (let i = 0; i < 5; i++) {
    const side = i % 2 === 0;
    const t = 0.03 + r() * 0.22;
    const x = side ? l0 + (r0 - l0) * t : r0 - (r0 - l0) * t;
    moss.push(
      <ellipse
        key={i}
        cx={x}
        cy={y0 - 2 * s}
        rx={(10 + r() * 22) * s}
        ry={(3 + r() * 4) * s}
        fill={mix(C.moss, C.fogDeep, h * 0.7)}
        opacity={0.85 - h * 0.3}
      />
    );
  }

  return (
    <g>
      <polygon points={`${l0},${y0} ${r0},${y0} ${r1},${y1} ${l1},${y1}`} fill={base} />
      {/* The tread top catches more sky at its front edge than at its back —
          that gradient plus a dark corner is what makes a stair read as a
          stair when you are looking down at it. */}
      <polygon points={`${l0},${y0} ${r0},${y0} ${r1},${y1} ${l1},${y1}`} fill={`url(#tread-${d % 2})`} opacity={0.55 - h * 0.2} />
      <polygon
        points={`${l1},${y1} ${r1},${y1} ${r1},${y1 + (y0 - y1) * 0.34} ${l1},${y1 + (y0 - y1) * 0.34}`}
        fill={C.black}
        opacity={0.4 - h * 0.24}
      />
      {/* wet nosing — the only place the sky gets to touch the stone */}
      <path d={`M ${l0} ${y0} L ${r0} ${y0}`} stroke={edge} strokeWidth={Math.max(0.9, 3.2 * s)} opacity={0.62 - h * 0.26} />
      <polygon
        points={`${l0},${y0} ${r0},${y0} ${r0},${y0 + 6 * s} ${l0},${y0 + 6 * s}`}
        fill={C.black}
        opacity={0.34 - h * 0.18}
      />
      {moss}
      {/* standing water */}
      <ellipse
        cx={(l0 + r0) / 2 + (r() - 0.5) * treadW(d)}
        cy={y0 - (y0 - y1) * 0.45}
        rx={treadW(d) * (0.18 + r() * 0.2)}
        ry={Math.max(1.2, (y0 - y1) * 0.16)}
        fill={edge}
        opacity={0.12}
      />
    </g>
  );
};

/** A solid low wall on the outer edge. Without it the right third of the wide
 *  shot is an undifferentiated void, and the lantern post stands in nothing. */
const Parapet: React.FC = () => {
  const pts: string[] = [];
  const back: string[] = [];
  for (let d = 0; d <= TREAD_COUNT; d += 1) {
    const s = depthScale(d);
    pts.push(`${treadR(d)} ${treadY(d) - 104 * s}`);
    back.unshift(`${treadR(d) + 26 * s} ${treadY(d) - 96 * s}`);
  }
  return (
    <g>
      <path d={`M ${treadR(0) + 300} 1500 L ${pts.join(' L ')} L ${back.join(' L ')} L ${treadR(0) + 340} 1500 Z`} fill={C.slate} />
      <path d={`M ${treadR(0)} ${treadY(0)} L ${pts.join(' L ')}`} fill="none" stroke={C.stone} strokeWidth={3} opacity={0.55} />
      <path d={`M ${pts.join(' L ')}`} fill="none" stroke={C.stoneEdge} strokeWidth={2} opacity={0.3} />
      {/* the face of the wall, catching a little sky at the top */}
      <path d={`M ${pts.join(' L ')} L ${treadR(TREAD_COUNT)} ${treadY(TREAD_COUNT)} L ${treadR(0)} ${treadY(0)} Z`} fill="url(#parapet)" opacity={0.9} />
    </g>
  );
};

const Balustrade: React.FC = () => {
  const posts = [0, 1, 2, 3, 4, 6, 8, 10, 13, 16, 20];
  const tops = posts.map((d) => {
    const s = depthScale(d);
    return {x: treadL(d) + 16 * s, y: treadY(d) - 132 * s, base: treadY(d), s, d};
  });
  return (
    <g>
      <path
        d={`M ${tops.map((p) => `${p.x} ${p.y}`).join(' L ')}`}
        stroke={C.stone}
        strokeWidth={9}
        fill="none"
        strokeLinecap="round"
        opacity={0.95}
      />
      <path
        d={`M ${tops.map((p) => `${p.x} ${p.y - 5}`).join(' L ')}`}
        stroke={C.stoneEdge}
        strokeWidth={1.6}
        fill="none"
        opacity={0.28}
      />
      {tops.map((p) => (
        <g key={p.d}>
          <rect x={p.x - 8 * p.s} y={p.y} width={16 * p.s} height={p.base - p.y} fill={mix(C.stone, C.fogDeep, haze(p.d) * 0.6)} />
          <rect x={p.x - 8 * p.s} y={p.y} width={3 * p.s} height={p.base - p.y} fill={C.stoneEdge} opacity={0.18} />
          <ellipse cx={p.x} cy={p.y} rx={11 * p.s} ry={5 * p.s} fill={mix(C.stone, C.fog, haze(p.d) * 0.5)} />
        </g>
      ))}
    </g>
  );
};

// ── Foreground: what the lens looks past ────────────────────────────────────

export const ForegroundLayer: React.FC = () => {
  const blades = [];
  const r = rng(404);
  for (let i = 0; i < 22; i++) {
    const x = -120 + r() * 620;
    const h = 260 + r() * 420;
    const bend = (r() - 0.5) * 300;
    blades.push(
      <path
        key={i}
        d={`M ${x} 1240 C ${x + bend * 0.2} ${1240 - h * 0.5}, ${x + bend * 0.7} ${1240 - h * 0.85}, ${x + bend} ${1240 - h}`}
        stroke={C.black}
        strokeWidth={5 + r() * 9}
        fill="none"
        strokeLinecap="round"
        opacity={0.92}
      />
    );
  }
  const leaves = [];
  const r2 = rng(808);
  for (let i = 0; i < 12; i++) {
    const x = 1180 + r2() * 900;
    const y = -140 + r2() * 260;
    leaves.push(
      <ellipse key={i} cx={x} cy={y} rx={46 + r2() * 40} ry={18 + r2() * 14} fill={C.black} transform={`rotate(${(r2() - 0.5) * 70} ${x} ${y})`} />
    );
  }
  return (
    <g>
      {blades}
      <path d="M 1100 -180 C 1400 -60, 1700 -20, 2100 -120" stroke={C.black} strokeWidth={22} fill="none" strokeLinecap="round" />
      {leaves}
    </g>
  );
};
