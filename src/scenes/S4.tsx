// 4 · ONE MATCH              00:26.0 – 00:36.5      medium-close, locked
// One idea: the only match they have is burning down and the wick will not take.
//
// The whole scene is driven by one keyframed point — where Brack's hand is —
// with the flame hanging off the end of the matchstick and the light in the
// frame computed from wherever that flame happens to be.

import {EASE, blinks, kf, rad} from '../lib/math';
import {brow} from '../rig/motion';
import {Stage} from '../world/Stage';
import {Brack} from '../rig/Brack';
import {Pip} from '../rig/Pip';
import {Match, Sparks, Steam, Tin} from '../world/Props';
import {GROUND, LANTERN} from '../world/geometry';
import {brack, brackEye, gazeTo, hand, litAt, pip, pipEye} from './common';

const ANGLE = -34;

/** Where the flame sits, given the hand and how much matchstick is left. */
export function flameOf(hx: number, hy: number, burn: number) {
  const len = 30 * burn + 8;
  const a = rad(ANGLE);
  return {x: hx + Math.sin(a) * len, y: hy - Math.cos(a) * len};
}

export const S4: React.FC<{f: number}> = ({f}) => {
  const view = {cx: 1230, cy: 706, zoom: kf(f, [[624, 2.08], [876, 2.16]], EASE.linear)};

  const crouch = kf(f, [[630, 0], [664, 1]], EASE.inOut);
  const burn = kf(f, [[700, 1], [876, 0.3]], EASE.linear);

  // The one keyframed point the whole scene hangs off: Brack's right hand.
  const hx = kf(f, [[624, 1183], [664, 1152], [712, 1146], [744, 1258], [788, 1258], [796, 1244], [808, 1258], [834, 1258], [856, 1152], [876, 1152]], EASE.inOut);
  const hy = kf(f, [[624, 748], [664, 792], [712, 792], [744, 678], [788, 678], [796, 700], [808, 678], [834, 678], [856, 798], [876, 798]], EASE.inOut);
  const flame = kf(
    f,
    [[672, 0], [699, 0], [703, 1], [746, 1], [754, 0.7], [766, 0.48], [774, 0.86], [788, 0.56], [798, 0.7], [808, 0.82], [818, 0.72], [826, 0.18], [836, 0.4], [850, 0.58], [876, 0.46]],
    EASE.inOut
  );
  const steady = kf(f, [[703, 0.9], [746, 0.85], [756, 0.28], [792, 0.34], [818, 0.28], [826, 0.05], [842, 0.24], [876, 0.42]], EASE.inOut);
  const fl = flameOf(hx, hy, burn);
  const light = {x: fl.x, y: fl.y, r: 260, i: 0.52 * flame};

  const spit = Math.max(
    kf(f, [[744, 0], [754, 1], [784, 1], [792, 0]], EASE.linear),
    kf(f, [[806, 0], [816, 1], [830, 1], [838, 0]], EASE.linear)
  );

  // ── Brack ────────────────────────────────────────────────────────────────
  const alarm = kf(f, [[806, 0], [840, 1]], EASE.inOut);
  const bPose = brack(f, crouch, {
    // He has to lean into the lantern to reach the wick at all — which is
    // exactly the point: this is at the edge of what he can do.
    lean: kf(f, [[624, 0], [664, 4], [736, 14], [834, 14], [862, 2]], EASE.inOut),
    headTilt: kf(f, [[624, 2], [744, -3], [834, -3], [862, 7]], EASE.inOut),
    brow: brow('worry', 'alarm', alarm),
    mouth: f > 820 ? 'open' : 'frown',
    mouthOpen: kf(f, [[820, 0], [832, 0.5], [876, 0.35]], EASE.out),
    blink: blinks(f, [652, 730, 802, 868]),
    wide: kf(f, [[800, 0], [828, 0.5]], EASE.out),
    arms: {
      l: hand(
        kf(f, [[624, 1132], [648, 1126], [702, 1126], [726, 1140], [848, 1140], [868, 1132]], EASE.inOut),
        kf(f, [[624, 772], [648, 812], [702, 812], [726, 808], [848, 808], [868, 806]], EASE.inOut)
      ),
      r: hand(hx, hy),
    },
  });
  bPose.lit = litAt(light, brackEye(bPose).x, brackEye(bPose).y, 330);
  bPose.gaze = gazeTo(brackEye(bPose), fl, 130);

  // ── Pip ──────────────────────────────────────────────────────────────────
  const pPose = pip(f, {
    lean: kf(f, [[624, 2], [700, 7], [820, 10]], EASE.inOut),
    headTilt: kf(f, [[624, 12], [700, 9], [830, 4]], EASE.inOut),
    brow: brow('worry', 'alarm', kf(f, [[812, 0], [842, 1]], EASE.inOut)),
    mouth: f > 818 ? 'oh' : 'small',
    mouthOpen: kf(f, [[624, 0.3], [700, 0.5], [818, 0.9]], EASE.inOut),
    blink: blinks(f, [666, 738, 812]),
    wide: kf(f, [[690, 0], [712, 0.45], [818, 0.8]], EASE.out),
    arms: {l: {shoulder: 20, elbow: 26, hand: 0}, r: {shoulder: -18, elbow: -26, hand: 0}},
  });
  pPose.lit = litAt(light, pipEye(pPose).x, pipEye(pPose).y, 330);
  pPose.gaze = gazeTo(pipEye(pPose), fl, 170);

  return (
    <Stage f={f} view={view} door={1} wet={1} light={light} rain={1} fog={1} dofNear={14} dofFar={7} grain={0.16}
      above={
        <>
          <Steam x={LANTERN.wick.x} y={LANTERN.wick.y - 4} f={f} amount={spit * 0.9} />
          <Sparks x={LANTERN.wick.x} y={LANTERN.wick.y} f={f} amount={spit} seed={4} />
        </>
      }
    >
      <Pip pose={pPose} id="s4p" ground={GROUND} lightPos={light} />
      <Brack pose={bPose} id="s4b" ground={GROUND} lightPos={light} armsFront={f > 700} />
      {f > 636 && f < 710 ? (
        <g opacity={kf(f, [[636, 0], [644, 1], [700, 1], [710, 0]], EASE.linear)}>
          <Tin x={1124} y={798} open={kf(f, [[647, 0], [666, 1]], EASE.out)} angle={-10} />
        </g>
      ) : null}
      {f > 672 ? <Match x={hx} y={hy} f={f} angle={ANGLE} burn={burn} flame={flame} steady={steady} /> : null}
    </Stage>
  );
};
