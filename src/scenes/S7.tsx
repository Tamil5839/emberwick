// 7 · IT CATCHES             00:50.0 – 01:01.0      85mm close-up, centred
// One idea: it works.
//
// The only symmetrical frame in the film, the only long lens, the longest held
// shot so far — three patterns broken at once, all on the same beat. In the mix
// the music ducks here and the fire carries it.

import {EASE, blinks, kf, lerp} from '../lib/math';
import {brow} from '../rig/motion';
import {Stage} from '../world/Stage';
import {Brack} from '../rig/Brack';
import {Pip, Tuft} from '../rig/Pip';
import {Match} from '../world/Props';
import {Flame} from '../world/Flame';
import {brack, brackEye, gazeTo, hand, litAt, pip, pipEye} from './common';
import {CROUCH_DY, GROUND} from '../world/geometry';
import {flameOf} from './S4';

export const CATCH = 1220;
const LIFT_IN = 1372;

export const S7: React.FC<{f: number}> = ({f}) => {
  // Scene 6 ends on the tuft at screen (866, 561); this opens on the tuft at
  // the same point, then drifts 20 frames into the climax framing. That is the
  // match cut — the audience never sees the join.
  const view = {
    cx: kf(f, [[1200, 1117], [1242, 1122], [LIFT_IN, 1140], [1464, 1212]], EASE.soft),
    cy: kf(f, [[1200, 791], [1242, 752], [LIFT_IN, 752], [1464, 700]], EASE.soft),
    zoom: kf(f, [[1200, 4.6], [LIFT_IN, 4.6], [1464, 3.5]], EASE.soft),
  };

  // Brack's right hand is the only keyframed point; the tuft rides just above
  // it and the light rides on the tuft.
  const rhx = kf(f, [[1200, 1124], [CATCH, 1152], [LIFT_IN, 1152], [1452, 1240], [1464, 1240]], EASE.inOut);
  const rhy = kf(f, [[1200, 804], [CATCH, 800], [LIFT_IN, 800], [1452, 668], [1464, 666]], EASE.inOut);
  const tx = rhx - 6;
  const ty = rhy - 10;

  const burn = kf(f, [[1200, 0.08], [1226, 0.02]], EASE.linear);
  const matchFlame = kf(f, [[1200, 0.3], [1218, 0.34], [1226, 0]], EASE.inOut);
  const tuftFlame = kf(f, [[CATCH - 3, 0], [CATCH, 5], [CATCH + 7, 30], [CATCH + 16, 21], [1464, 20]], EASE.out);
  const mhx = kf(f, [[1200, 1150], [CATCH, 1150], [1306, 1132], [LIFT_IN, 1132], [1452, 1188]], EASE.inOut);
  const mhy = kf(f, [[1200, 802], [CATCH, 804], [1306, 810], [LIFT_IN, 810], [1452, 728]], EASE.inOut);
  const mf = flameOf(mhx, mhy, burn);

  const light = {
    x: f < CATCH ? mf.x : tx,
    y: f < CATCH ? mf.y : ty - tuftFlame * 0.7,
    // A tuft of burning moss lights a face, not a staircase.
    r: kf(f, [[1200, 180], [CATCH, 200], [CATCH + 12, 232], [1464, 240]], EASE.out),
    i: kf(f, [[1200, 0.18], [CATCH - 1, 0.2], [CATCH + 4, 1], [1250, 0.95], [1464, 0.95]], EASE.out),
  };

  // ── Both of them react, then settle into the cupped-arc ──────────────────
  const react = kf(f, [[CATCH, 0], [CATCH + 10, 1]], EASE.out);
  const close = kf(f, [[1248, 0], [1300, 1]], EASE.inOut);
  const warmth = kf(f, [[1296, 0], [1338, 1]], EASE.inOut);
  const lift = kf(f, [[LIFT_IN, 0], [1452, 1]], EASE.soft);

  // He sinks over the flame as it takes and bows his head, which is the only
  // way two faces 106 units apart end up in the same close-up.
  const bPose = brack(f, 1, {
    y: kf(f, [[1200, GROUND + CROUCH_DY], [1252, GROUND + 58], [LIFT_IN, GROUND + 58], [1452, GROUND + 42]], EASE.soft),
    headY: kf(f, [[1200, 2], [1252, 12], [LIFT_IN, 12], [1444, 0]], EASE.soft),
    lean: kf(f, [[1200, 3], [1252, 2], [LIFT_IN, 2], [1452, 12]], EASE.soft),
    headTilt: kf(f, [[1200, 8], [1252, 19], [1330, 17], [LIFT_IN, 15], [1452, -10]], EASE.soft),
    brow: brow('sad', react > 0.5 ? 'lift' : 'sad', react * 0.9),
    mouth: f > 1300 ? 'smile' : f > CATCH + 4 ? 'oh' : 'press',
    mouthOpen: kf(f, [[CATCH, 0], [CATCH + 8, 0.55], [1300, 0.2]], EASE.out),
    wide: kf(f, [[CATCH, 0], [CATCH + 8, 0.85], [1310, 0.45]], EASE.out),
    blink: blinks(f, [1268, 1346, 1424]),
    // His left hand closes in to shield the flame from the rain.
    arms: {
      l: hand(mhx, mhy),
      r: hand(rhx, rhy),
    },
  });
  bPose.lit = litAt(light, brackEye(bPose).x, brackEye(bPose).y, 300);

  const pPose = pip(f, {
    x: 1068,
    lean: lerp(7, 11, close),
    headTilt: lerp(8, 4, close) + lift * 5,
    brow: brow('lift', 'soft', warmth),
    mouth: f > 1300 ? 'smile' : f > CATCH + 4 ? 'oh' : 'small',
    mouthOpen: kf(f, [[CATCH, 0.5], [CATCH + 8, 1], [1300, 0.25]], EASE.out),
    wide: kf(f, [[CATCH, 0.4], [CATCH + 8, 1], [1310, 0.6]], EASE.out),
    blink: blinks(f, [1312, 1400]),
    // Pip has already done his part. He keeps his hands to himself and
    // watches, which is a better beat than crowding the flame.
    arms: {
      l: hand(1052, 842),
      r: hand(lerp(1116, 1095, close), lerp(798, 840, close)),
    },
    legs: {l: {hip: lerp(16, 8, close), knee: lerp(6, 3, close)}, r: {hip: lerp(-12, -5, close), knee: lerp(14, 6, close)}},
  });
  pPose.lit = litAt(light, pipEye(pPose).x, pipEye(pPose).y, 300);

  // Eyes on the flame — until they look at each other, which is the film.
  const bToFlame = gazeTo(brackEye(bPose), {x: tx, y: ty}, 90);
  const bToPip = gazeTo(brackEye(bPose), {x: 1069, y: 800}, 90);
  const pToFlame = gazeTo(pipEye(pPose), {x: tx, y: ty}, 120);
  const pToBrack = gazeTo(pipEye(pPose), {x: 1180, y: 722}, 100);
  const meet = kf(f, [[1330, 0], [1352, 1], [1372, 1], [1392, 0]], EASE.inOut);
  bPose.gaze = {x: lerp(bToFlame.x, bToPip.x, meet), y: lerp(bToFlame.y, bToPip.y, meet)};
  pPose.gaze = {x: lerp(pToFlame.x, pToBrack.x, meet), y: lerp(pToFlame.y, pToBrack.y, meet)};

  return (
    <Stage f={f} view={view} door={1} wet={1 - kf(f, [[CATCH, 0], [1300, 0.6]], EASE.linear)} light={light} rain={0.72} fog={1} dofFar={30} dofNear={40} grain={0.15}>
      <Pip pose={pPose} id="s7p" tuft={false} ground={GROUND} lightPos={light} />
      <Brack pose={bPose} id="s7b" ground={GROUND} lightPos={light} armsFront />
      {matchFlame > 0.02 ? <Match x={mhx} y={mhy} f={f} angle={-34} burn={burn} flame={matchFlame} /> : null}
      <g transform={`translate(${tx} ${ty}) rotate(${kf(f, [[1200, -2], [1452, -14]], EASE.inOut)})`}>
        <Tuft scale={0.92} lit={Math.min(1, tuftFlame / 18)} burn={kf(f, [[CATCH, 0], [CATCH + 22, 0.45], [1464, 0.9]], EASE.linear)} />
      </g>
      {tuftFlame > 0.5 ? <Flame x={tx} y={ty - 6} size={tuftFlame} f={f} seed={55} steady={Math.min(1, (f - CATCH) / 30)} /> : null}
    </Stage>
  );
};
