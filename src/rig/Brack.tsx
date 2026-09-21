// BRACK — the tall one. Waxed canvas, a hood that is the film's signature
// cupped arc, and eyebrows that do almost all of his talking.
// Local origin (0,0) is between his feet; he stands 228 units tall.

import {C} from '../lib/palette';
import {ArmLimb, Brow, ContactShadow, Eye, LegLimb, MouthShape} from './parts';
import {solveLimb, toLocal} from './motion';
import type {Arm, Leg, Pose} from './types';

export const BRACK_HEIGHT = 228;

// Shoulders sit well below the hood line; at -168 a reaching arm crossed
// his own face.
const SHOULDER = {l: {x: -24, y: -150}, r: {x: 24, y: -150}};
const HIP = {l: {x: -13, y: -86}, r: {x: 13, y: -86}};
const ARM = {upper: 42, lower: 38};
const LEG = {upper: 44, lower: 42};

const HOOD = `M -30 -174
  C -35 -214, -20 -240, 2 -240
  C 25 -240, 37 -215, 32 -174
  C 20 -166, -18 -166, -30 -174 Z`;

const CLOAK = `M -25 -180
  C -41 -142, -46 -112, -41 -84
  Q 0 -73 41 -84
  C 46 -112, 41 -142, 25 -180 Z`;

/** The collar Brack gives away in the last scene. Also worn by Pip after that. */
export const Collar: React.FC<{scale?: number; opacity?: number}> = ({scale = 1, opacity = 1}) => (
  <g transform={`scale(${scale})`} opacity={opacity}>
    <path d="M -27 -178 Q 0 -166 28 -178 Q 30 -170 28 -164 Q 0 -152 -27 -164 Q -29 -170 -27 -178 Z" fill={C.brackCollar} />
    <path d="M -27 -172 Q 0 -161 28 -172" fill="none" stroke={C.black} strokeOpacity={0.3} strokeWidth={1.6} />
  </g>
);

export const Brack: React.FC<{
  pose: Pose;
  id?: string;
  collar?: boolean;
  /** Draw the far arm in front of the cloak. When he hunches over the flame
   *  both elbows go out, and a far arm behind the cloak shows only an elbow. */
  armsFront?: boolean;
  /** Where the key light is, in world space. Drives the rim on his silhouette. */
  lightPos?: {x: number; y: number; r: number};
  shadow?: number;
  /** World y of the ground, so the shadow stays put when he crouches. */
  ground?: number;
  holdingLeft?: React.ReactNode;
  holdingRight?: React.ReactNode;
}> = ({pose: p, id = 'brack', collar = true, armsFront = false, lightPos, shadow = 0.34, ground, holdingLeft, holdingRight}) => {
  const turn = p.headTurn * 5;
  const key = lightPos ? toLocal(p, lightPos.x, lightPos.y) : null;

  const armL = resolve(p.arms.l, SHOULDER.l, ARM, 1, p);
  const armR = resolve(p.arms.r, SHOULDER.r, ARM, -1, p);
  const legL = resolveLeg(p.legs.l, HIP.l, LEG, -1, p);
  const legR = resolveLeg(p.legs.r, HIP.r, LEG, -1, p);

  const farArm = (
    <ArmLimb
      x={SHOULDER.l.x}
      y={SHOULDER.l.y}
      upper={ARM.upper}
      lower={ARM.lower}
      w={12}
      arm={armL}
      color={C.brackLimb}
      handR={8.5}
      rim={key ? `url(#key-${id})` : undefined}
      rimW={1.8}
      holding={holdingLeft}
    />
  );

  return (
    <g transform={`translate(${p.x} ${p.y + p.bob})`}>
      <g transform={`translate(0 ${(ground ?? p.y) - (p.y + p.bob)})`}><ContactShadow w={46} h={9} opacity={shadow} /></g>
      <g transform={`scale(${(p.flip ? -1 : 1) * p.scale} ${p.scale})`}>
        <g transform={`rotate(${p.lean}) scale(${1 + (1 - p.squash) * 0.7} ${p.squash})`}>
          <defs>
            {/* the overcast sky is an enormous softbox directly overhead */}
            <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0.15" y2="1">
              <stop offset="0" stopColor={C.stoneEdge} stopOpacity="0.55" />
              <stop offset="0.35" stopColor={C.stoneEdge} stopOpacity="0.12" />
              <stop offset="0.75" stopColor={C.stoneEdge} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`cloth-${id}`} x1="0" y1="0" x2="0.2" y2="1">
              <stop offset="0" stopColor="#453A2E" />
              <stop offset="0.55" stopColor={C.brackBody} />
              <stop offset="1" stopColor="#2A231C" />
            </linearGradient>
            {key ? (
              <radialGradient id={`key-${id}`} gradientUnits="userSpaceOnUse" cx={key.x} cy={key.y} r={Math.max(34, (lightPos!.r * 0.26) / p.scale)}>
                <stop offset="0" stopColor={C.flameCore} stopOpacity="1" />
                <stop offset="0.35" stopColor={C.ember} stopOpacity="0.7" />
                <stop offset="1" stopColor={C.ember} stopOpacity="0" />
              </radialGradient>
            ) : null}
          </defs>

          <LegLimb x={HIP.l.x} y={HIP.l.y} upper={LEG.upper} lower={LEG.lower} w={13} leg={legL} color={C.brackLimb} footR={8} />
          {armsFront ? null : farArm}

          <path d={CLOAK} fill={`url(#cloth-${id})`} />
          <path d="M -12 -178 C -18 -140 -20 -112 -17 -86" fill="none" stroke={C.black} strokeOpacity={0.22} strokeWidth={2.4} />

          <LegLimb x={HIP.r.x} y={HIP.r.y} upper={LEG.upper} lower={LEG.lower} w={13.5} leg={legR} color={C.brackLimb} footR={8.5} />

          {collar ? <Collar /> : null}

          {/* The head is drawn over the collar: when he bows it, the hood has
              to pass in front of the collar, not behind it. */}
          <g transform={`translate(${turn} ${p.headY}) rotate(${p.headTilt} 0 -180)`}>
            <path d={HOOD} fill={C.brackHood} />
            <ellipse cx={4} cy={-199} rx={24.5} ry={25} fill={C.black} opacity={0.62} />
            <ellipse cx={5} cy={-198} rx={19.5} ry={20.5} fill={C.brackFace} />
            <Eye id={`${id}-l`} cx={-3 + turn * 0.4} cy={-201} rx={7.2} ry={7.8} gaze={p.gaze} blink={p.blink} lidColor={C.brackFace} warm={p.lit} wide={p.wide} />
            <Eye id={`${id}-r`} cx={13 + turn * 0.4} cy={-201} rx={7.2} ry={7.8} gaze={p.gaze} blink={p.blink} lidColor={C.brackFace} warm={p.lit} wide={p.wide} />
            <Brow cx={-3 + turn * 0.4} cy={-214 + p.brow.l.y} w={14} t={3.1} a={p.brow.l.a} color={C.brackHood} />
            <Brow cx={13 + turn * 0.4} cy={-214 + p.brow.r.y} w={14} t={3.1} a={p.brow.r.a} color={C.brackHood} />
            <MouthShape cx={5 + turn * 0.5} cy={-186} w={13.5} shape={p.mouth} open={p.mouthOpen} color={C.black} />
            <path d={HOOD} fill="none" stroke={C.black} strokeOpacity={0.28} strokeWidth={2} />
            <path d={HOOD} fill="none" stroke={`url(#sky-${id})`} strokeWidth={2.6} />
            {key ? <path d={HOOD} fill="none" stroke={`url(#key-${id})`} strokeWidth={3.2} opacity={p.lit} style={{mixBlendMode: 'screen'}} /> : null}
          </g>

          {armsFront ? farArm : null}

          <ArmLimb x={SHOULDER.r.x} y={SHOULDER.r.y} upper={ARM.upper} lower={ARM.lower} w={12.5} arm={armR} color={C.brackLimb} handR={9} rim={key ? `url(#key-${id})` : undefined} rimW={2.0} holding={holdingRight} />

          <path d={CLOAK} fill="none" stroke={`url(#sky-${id})`} strokeWidth={2.6} />
          {key ? <path d={CLOAK} fill="none" stroke={`url(#key-${id})`} strokeWidth={3.2} opacity={p.lit} style={{mixBlendMode: 'screen'}} /> : null}
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
