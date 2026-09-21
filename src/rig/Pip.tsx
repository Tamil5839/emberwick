// PIP — one third of Brack's height, round where Brack is tall, moss where
// Brack is canvas. The pale tuft on his head is the only dry thing in the film,
// which is why giving it away costs something the audience can see.
// Local origin (0,0) is between his feet; he stands 74 units tall.

import {C} from '../lib/palette';
import {ArmLimb, Brow, ContactShadow, Eye, LegLimb, MouthShape} from './parts';
import {solveLimb, toLocal} from './motion';
import {Collar} from './Brack';
import type {Arm, Leg, Pose} from './types';

export const PIP_HEIGHT = 74;

// Below the eyeline, for the same reason as Brack's.
const SHOULDER = {l: {x: -25, y: -34}, r: {x: 25, y: -34}};
const HIP = {l: {x: -9, y: -26}, r: {x: 9, y: -26}};
const ARM = {upper: 15, lower: 14};
const LEG = {upper: 13, lower: 13};

const BODY = `M -27 -34
  C -28 -58, -16 -70, 1 -70
  C 19 -70, 29 -57, 28 -34
  C 27 -18, 16 -9, 0 -9
  C -16 -9, -26 -18, -27 -34 Z`;

/** The tuft. Drawn standalone so it can sit on Pip, in his hands, or in Brack's.
 *  `burn` chars it from the edges in once it is doing its job. */
export const Tuft: React.FC<{scale?: number; opacity?: number; lit?: number; seed?: number; burn?: number}> = ({
  scale = 1,
  opacity = 1,
  lit = 0,
  seed = 0,
  burn = 0,
}) => {
  const blobs: [number, number, number][] = [
    [-10, 1, 6], [-4, -4, 7.4], [4, -4.6, 7], [10, 0, 6], [0, 2.4, 6.6], [-7, -2, 5.2], [7, -2, 5.2],
  ];
  return (
    <g transform={`scale(${scale})`} opacity={opacity}>
      {blobs.map(([x, y, r], i) => (
        <circle
          key={i}
          cx={x + Math.sin(seed + i) * 0.5}
          cy={y}
          r={r * (1 - burn * 0.25)}
          fill={burn > 0.3 && i % 3 === 0 ? '#5A5145' : i % 2 ? C.pipTuft : C.pipTuftDry}
        />
      ))}
      {blobs.map(([x, y], i) => (
        <path
          key={`f${i}`}
          d={`M ${x} ${y} l ${Math.cos(i * 1.7) * 8} ${-4.5 - (i % 3) * 2.4}`}
          stroke={C.pipTuftDry}
          strokeWidth={1.2}
          strokeLinecap="round"
          fill="none"
          opacity={0.8 * (1 - burn * 0.6)}
        />
      ))}
      {lit > 0.02 ? (
        <g style={{mixBlendMode: 'screen'}} opacity={lit}>
          {blobs.map(([x, y, r], i) => (
            <circle key={`l${i}`} cx={x} cy={y} r={r} fill={C.ember} opacity={0.32} />
          ))}
        </g>
      ) : null}
    </g>
  );
};

export const Pip: React.FC<{
  pose: Pose;
  id?: string;
  tuft?: boolean;
  collar?: boolean;
  lightPos?: {x: number; y: number; r: number};
  shadow?: number;
  /** World y of the ground, so the shadow stays put when he crouches. */
  ground?: number;
  holdingLeft?: React.ReactNode;
  holdingRight?: React.ReactNode;
}> = ({pose: p, id = 'pip', tuft = true, collar = false, lightPos, shadow = 0.3, ground, holdingLeft, holdingRight}) => {
  const turn = p.headTurn * 4;
  const key = lightPos ? toLocal(p, lightPos.x, lightPos.y) : null;

  const armL = resolve(p.arms.l, SHOULDER.l, ARM, 1, p);
  const armR = resolve(p.arms.r, SHOULDER.r, ARM, -1, p);
  const legL = resolveLeg(p.legs.l, HIP.l, LEG, -1, p);
  const legR = resolveLeg(p.legs.r, HIP.r, LEG, -1, p);

  return (
    <g transform={`translate(${p.x} ${p.y + p.bob})`}>
      <g transform={`translate(0 ${(ground ?? p.y) - (p.y + p.bob)})`}><ContactShadow w={24} h={6} opacity={shadow} /></g>
      <g transform={`scale(${(p.flip ? -1 : 1) * p.scale} ${p.scale})`}>
        <g transform={`rotate(${p.lean}) scale(${1 + (1 - p.squash) * 0.7} ${p.squash})`}>
          <defs>
            <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0.15" y2="1">
              <stop offset="0" stopColor={C.stoneEdge} stopOpacity="0.6" />
              <stop offset="0.35" stopColor={C.stoneEdge} stopOpacity="0.14" />
              <stop offset="0.75" stopColor={C.stoneEdge} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`moss-${id}`} x1="0" y1="0" x2="0.18" y2="1">
              <stop offset="0" stopColor="#3B4C38" />
              <stop offset="0.6" stopColor={C.pipBody} />
              <stop offset="1" stopColor="#222E21" />
            </linearGradient>
            {key ? (
              <radialGradient id={`key-${id}`} gradientUnits="userSpaceOnUse" cx={key.x} cy={key.y} r={Math.max(24, (lightPos!.r * 0.2) / p.scale)}>
                <stop offset="0" stopColor={C.flameCore} stopOpacity="1" />
                <stop offset="0.35" stopColor={C.ember} stopOpacity="0.7" />
                <stop offset="1" stopColor={C.ember} stopOpacity="0" />
              </radialGradient>
            ) : null}
          </defs>

          <LegLimb x={HIP.l.x} y={HIP.l.y} upper={LEG.upper} lower={LEG.lower} w={8} leg={legL} color={C.pipLimb} footR={5.5} />
          <ArmLimb x={SHOULDER.l.x} y={SHOULDER.l.y} upper={ARM.upper} lower={ARM.lower} w={8} arm={armL} color={C.pipLimb} handR={6} rim={key ? `url(#key-${id})` : undefined} rimW={1.4} holding={holdingLeft} />
          <LegLimb x={HIP.r.x} y={HIP.r.y} upper={LEG.upper} lower={LEG.lower} w={8.5} leg={legR} color={C.pipLimb} footR={5.5} />

          <path d={BODY} fill={`url(#moss-${id})`} />
          <ellipse cx={2} cy={-22} rx={17} ry={11} fill={C.pipBelly} opacity={0.6} />

          <g transform={`translate(${turn} ${p.headY}) rotate(${p.headTilt} 0 -44)`}>
            {tuft ? (
              <g transform="translate(1 -73)">
                <Tuft lit={p.lit} />
              </g>
            ) : (
              <g opacity={0.8}>
                {[-9, -3, 4, 10].map((x, i) => (
                  <path key={i} d={`M ${x} -68 l ${i % 2 ? 1.4 : -1.4} -3.2`} stroke={C.pipTuft} strokeWidth={1.7} strokeLinecap="round" />
                ))}
              </g>
            )}
            <Eye id={`${id}-l`} cx={-10 + turn * 0.4} cy={-45} rx={8.6} ry={9.6} gaze={p.gaze} blink={p.blink} lidColor={C.pipBody} warm={p.lit} wide={p.wide} />
            <Eye id={`${id}-r`} cx={11 + turn * 0.4} cy={-45} rx={8.6} ry={9.6} gaze={p.gaze} blink={p.blink} lidColor={C.pipBody} warm={p.lit} wide={p.wide} />
            <Brow cx={-10 + turn * 0.4} cy={-58 + p.brow.l.y} w={14} t={3} a={p.brow.l.a} color={C.pipLimb} />
            <Brow cx={11 + turn * 0.4} cy={-58 + p.brow.r.y} w={14} t={3} a={p.brow.r.a} color={C.pipLimb} />
            <MouthShape cx={1 + turn * 0.5} cy={-28} w={12} shape={p.mouth} open={p.mouthOpen} color={C.black} />
            {collar ? (
              <g transform="translate(1 48) scale(0.9 0.66)">
                <Collar />
              </g>
            ) : null}
          </g>

          <ArmLimb x={SHOULDER.r.x} y={SHOULDER.r.y} upper={ARM.upper} lower={ARM.lower} w={8.5} arm={armR} color={C.pipLimb} handR={6.5} rim={key ? `url(#key-${id})` : undefined} rimW={1.6} holding={holdingRight} />

          <path d={BODY} fill="none" stroke={`url(#sky-${id})`} strokeWidth={2.2} />
          {key ? <path d={BODY} fill="none" stroke={`url(#key-${id})`} strokeWidth={2.8} opacity={p.lit} style={{mixBlendMode: 'screen'}} /> : null}
        </g>
      </g>
    </g>
  );
};

function resolve(arm: Arm, s: {x: number; y: number}, l: {upper: number; lower: number}, bend: 1 | -1, p: Pose): Arm {
  if (!arm.target) return arm;
  const t = toLocal(p, arm.target.x, arm.target.y);
  const {a, b} = solveLimb(s.x, s.y, t.x, t.y, l.upper, l.lower, bend);
  return {shoulder: a, elbow: b, hand: arm.hand};
}

function resolveLeg(leg: Leg, h: {x: number; y: number}, l: {upper: number; lower: number}, bend: 1 | -1, p: Pose): Leg {
  if (!leg.target) return leg;
  const t = toLocal(p, leg.target.x, leg.target.y);
  const {a, b} = solveLimb(h.x, h.y, t.x, t.y, l.upper, l.lower, bend);
  return {hip: a, knee: b};
}
