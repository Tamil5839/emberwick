// Shared rig parts. Both characters are assembled from exactly these pieces,
// which is what keeps them reading as two inhabitants of one world.

import {C} from '../lib/palette';
import type {Arm, Leg, Mouth} from './types';

// ── Eye ─────────────────────────────────────────────────────────────────────
// A sclera, a pupil that carries gaze, lids that carry blinks, and a catchlight
// that turns from cold daylight-blue to firelight when the flame arrives.

export const Eye: React.FC<{
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  gaze: {x: number; y: number};
  blink: number;
  lidColor: string;
  warm?: number;
  wide?: number;
}> = ({id, cx, cy, rx, ry, gaze, blink, lidColor, warm = 0, wide = 0}) => {
  const openRy = ry * (1 + wide * 0.22);
  const pr = Math.min(rx, openRy) * 0.52;
  // Held back from the rim: a pupil jammed against the edge of the eye reads
  // as a dead stare rather than as looking at something.
  const px = cx + gaze.x * (rx - pr) * 0.78;
  const py = cy + gaze.y * (openRy - pr) * 0.72;
  const lidTop = cy - openRy + blink * openRy * 1.45;
  const lidBot = cy + openRy - blink * openRy * 0.55;
  const catchR = pr * (0.3 + warm * 0.22);

  return (
    <g>
      <clipPath id={`eye-${id}`}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={openRy} />
      </clipPath>
      <ellipse cx={cx} cy={cy} rx={rx} ry={openRy} fill={C.sclera} opacity={0.88 + warm * 0.12} />
      <g clipPath={`url(#eye-${id})`}>
        <circle cx={px} cy={py} r={pr} fill={C.pupil} />
        <circle
          cx={px - pr * 0.34}
          cy={py - pr * 0.36}
          r={catchR}
          fill={warm > 0.02 ? C.flameCore : C.catchCool}
          opacity={0.75 + warm * 0.25}
        />
        {warm > 0.15 ? (
          // The flame itself, reflected. Four eyes hold it at the climax.
          <path
            d={`M ${px + pr * 0.28} ${py + pr * 0.42}
                q ${-pr * 0.3} ${-pr * 0.35} 0 ${-pr * 0.95}
                q ${pr * 0.3} ${pr * 0.6} 0 ${pr * 0.95} z`}
            fill={C.ember}
            opacity={warm * 0.95}
          />
        ) : null}
        {/* Lids are drawn in the character's own colour, so they read as skin. */}
        <rect x={cx - rx - 2} y={cy - openRy - ry * 2.4} width={rx * 2 + 4} height={ry * 2.4 + (lidTop - cy + openRy)} fill={lidColor} />
        <rect x={cx - rx - 2} y={lidBot} width={rx * 2 + 4} height={ry * 2.4} fill={lidColor} />
      </g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={openRy} fill="none" stroke={C.black} strokeOpacity={0.35} strokeWidth={rx * 0.1} />
    </g>
  );
};

// ── Brow ────────────────────────────────────────────────────────────────────
// Brack acts almost entirely from here. Inner-end lift reads as worry; the
// whole brow dropping reads as resolve.

export const Brow: React.FC<{
  cx: number;
  cy: number;
  w: number;
  t: number;
  a: number;
  color: string;
  curve?: number;
}> = ({cx, cy, w, t, a, color, curve = 0.35}) => (
  <g transform={`translate(${cx} ${cy}) rotate(${a})`}>
    <path
      d={`M ${-w / 2} 0 q ${w / 2} ${-w * curve} ${w} 0`}
      fill="none"
      stroke={color}
      strokeWidth={t}
      strokeLinecap="round"
    />
  </g>
);

// ── Mouth ───────────────────────────────────────────────────────────────────

export const MouthShape: React.FC<{
  cx: number;
  cy: number;
  w: number;
  shape: Mouth;
  open: number;
  color: string;
}> = ({cx, cy, w, shape, open, color}) => {
  const t = w * 0.15;
  const h = w * 0.55 * open;
  switch (shape) {
    case 'open':
    case 'oh':
      return (
        <ellipse
          cx={cx}
          cy={cy + h * 0.2}
          rx={w * (shape === 'oh' ? 0.3 : 0.38)}
          ry={Math.max(w * 0.15, h * 0.95)}
          fill={color}
        />
      );
    case 'smile':
      return (
        <path d={`M ${cx - w / 2} ${cy - w * 0.1} q ${w / 2} ${w * 0.55} ${w} 0`} fill="none" stroke={color} strokeWidth={t} strokeLinecap="round" />
      );
    case 'frown':
      return (
        <path d={`M ${cx - w / 2} ${cy + w * 0.14} q ${w / 2} ${-w * 0.5} ${w} 0`} fill="none" stroke={color} strokeWidth={t} strokeLinecap="round" />
      );
    case 'wobble':
      return (
        <path
          d={`M ${cx - w / 2} ${cy} q ${w * 0.18} ${-w * 0.22} ${w * 0.34} 0 q ${w * 0.16} ${w * 0.22} ${w * 0.32} 0 q ${w * 0.16} ${-w * 0.2} ${w * 0.34} 0`}
          fill="none"
          stroke={color}
          strokeWidth={t * 0.85}
          strokeLinecap="round"
        />
      );
    case 'press':
      return <path d={`M ${cx - w * 0.36} ${cy} q ${w * 0.36} ${-w * 0.13} ${w * 0.72} 0`} fill="none" stroke={color} strokeWidth={t * 1.25} strokeLinecap="round" />;
    case 'small':
      return <ellipse cx={cx} cy={cy} rx={w * 0.17} ry={w * 0.13 + h * 0.3} fill={color} />;
    case 'flat':
    default:
      return <path d={`M ${cx - w * 0.3} ${cy} h ${w * 0.6}`} fill="none" stroke={color} strokeWidth={t} strokeLinecap="round" />;
  }
};

// ── Limbs ───────────────────────────────────────────────────────────────────
// Two tapered segments with forward kinematics. 0deg points straight down.

export const ArmLimb: React.FC<{
  x: number;
  y: number;
  upper: number;
  lower: number;
  w: number;
  arm: Arm;
  color: string;
  handR: number;
  handColor?: string;
  /** Paint for the light-facing edge — without it, a dark arm in front of a
   *  dark body disappears exactly when the hands matter most. */
  rim?: string;
  rimW?: number;
  holding?: React.ReactNode;
}> = ({x, y, upper, lower, w, arm, color, handR, handColor, rim, rimW = 2.4, holding}) => (
  <g transform={`translate(${x} ${y}) rotate(${arm.shoulder})`}>
    <path d={taper(upper, w, w * 0.82)} fill={color} stroke={rim} strokeWidth={rim ? rimW : undefined} />
    <g transform={`translate(0 ${upper}) rotate(${arm.elbow})`}>
      <path d={taper(lower, w * 0.82, w * 0.68)} fill={color} stroke={rim} strokeWidth={rim ? rimW : undefined} />
      <g transform={`translate(0 ${lower}) rotate(${arm.hand})`}>
        <circle r={handR} fill={handColor ?? color} stroke={rim} strokeWidth={rim ? rimW : undefined} />
        {holding}
      </g>
    </g>
  </g>
);

export const LegLimb: React.FC<{
  x: number;
  y: number;
  upper: number;
  lower: number;
  w: number;
  leg: Leg;
  color: string;
  footR: number;
}> = ({x, y, upper, lower, w, leg, color, footR}) => (
  <g transform={`translate(${x} ${y}) rotate(${leg.hip})`}>
    <path d={taper(upper, w, w * 0.86)} fill={color} />
    <g transform={`translate(0 ${upper}) rotate(${leg.knee})`}>
      <path d={taper(lower, w * 0.86, w * 0.7)} fill={color} />
      <ellipse cx={footR * 0.28} cy={lower} rx={footR * 1.25} ry={footR * 0.8} fill={color} />
    </g>
  </g>
);

/** A rounded, tapering capsule from (0,0) down to (0,len). */
function taper(len: number, w0: number, w1: number) {
  const a = w0 / 2;
  const b = w1 / 2;
  return `M ${-a} 0 L ${-b} ${len} a ${b} ${b} 0 0 0 ${b * 2} 0 L ${a} 0 a ${a} ${a} 0 0 0 ${-a * 2} 0 z`;
}

// ── Contact shadow ──────────────────────────────────────────────────────────

export const ContactShadow: React.FC<{w: number; h: number; opacity: number}> = ({w, h, opacity}) => (
  <ellipse cx={0} cy={0} rx={w * 1.6} ry={h * 1.7} fill="url(#shadow-soft)" opacity={opacity} />
);
