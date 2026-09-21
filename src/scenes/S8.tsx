// 8 · EMBERWICK              01:01.0 – 01:13.0      pull back to wide, then hold
// One idea: the light is on, and neither of them is alone.
//
// The camera does not cut here — it starts exactly where scene 7's lens ended
// and pulls all the way back to scene 1's opening frame. The last image of the
// film is the first image of the film with the light on.

import {EASE, blinks, kf, lerp} from '../lib/math';
import {brow} from '../rig/motion';
import {Stage} from '../world/Stage';
import {Brack, Collar} from '../rig/Brack';
import {Pip, Tuft} from '../rig/Pip';
import {GROUND, LANTERN} from '../world/geometry';
import {brack, brackEye, gazeTo, hand, litAt, pip, pipEye} from './common';

const TAKES = 1470;      // the wick catches — the bell in the mix lands here
const UNWIND = 1512;     // Brack starts unwinding his collar
const WRAPPED = 1548;    // it is around Pip's head

export const S8: React.FC<{f: number}> = ({f}) => {
  // The pull-out stops halfway and waits, because the second gift is small and
  // the audience cannot read it from a wide. Then it goes all the way back to
  // scene 1's opening frame.
  const view = {
    cx: kf(f, [[1464, 1212], [1480, 1212], [1506, 1170], [1560, 1170], [1650, 960]], EASE.soft),
    cy: kf(f, [[1464, 700], [1480, 700], [1506, 754], [1560, 754], [1650, 560]], EASE.soft),
    zoom: kf(f, [[1464, 3.5], [1480, 3.5], [1506, 2.3], [1560, 2.3], [1650, 1.06]], EASE.soft),
  };

  const lit = kf(f, [[1466, 0], [TAKES, 0.35], [1486, 1]], EASE.out);
  const light = {
    x: LANTERN.wick.x,
    y: LANTERN.wick.y - 6,
    r: kf(f, [[1464, 290], [1506, 400], [1752, 450]], EASE.soft),
    i: kf(f, [[1464, 0.9], [TAKES, 0.95], [1500, 1]], EASE.out),
  };

  const unwind = kf(f, [[UNWIND, 0], [1540, 1]], EASE.inOut);
  const settle = kf(f, [[1556, 0], [1626, 1]], EASE.soft);

  // ── Brack: puts the flame away, then gives away the second thing ─────────
  const bPose = brack(f, 1, {
    // Leaning into the lantern to set the flame, then away toward Pip to give
    // him the collar. Both leans exist because he cannot otherwise reach.
    lean: kf(f, [[1464, 12], [1490, 4], [1508, -4], [1524, -10], [1572, -7], [1700, -6]], EASE.inOut),
    headTilt: kf(f, [[1464, -5], [1496, -2], [1524, 8], [1576, 4], [1650, -3]], EASE.inOut),
    brow: brow('soft', 'lift', kf(f, [[1570, 0], [1640, 1]], EASE.inOut)),
    mouth: 'smile',
    mouthOpen: 0.15,
    wide: kf(f, [[1464, 0.4], [1520, 0.2], [1660, 0.35]], EASE.inOut),
    blink: blinks(f, [1512, 1592, 1676, 1724]),
    arms: {
      l: hand(
        kf(f, [[1464, 1188], [1500, 1140], [UNWIND, 1140], [1534, 1150], [1572, 1136], [1700, 1136]], EASE.inOut),
        kf(f, [[1464, 730], [1500, 806], [UNWIND, 806], [1534, 712], [1572, 806], [1700, 806]], EASE.inOut)
      ),
      r: hand(
        kf(f, [[1464, 1240], [1490, 1236], [1506, 1195], [UNWIND, 1162], [1536, 1078], [WRAPPED, 1071], [1600, 1090], [1752, 1090]], EASE.inOut),
        kf(f, [[1464, 666], [1490, 668], [1506, 790], [UNWIND, 702], [1536, 762], [WRAPPED, 772], [1600, 798], [1752, 798]], EASE.inOut)
      ),
    },
  });
  bPose.lit = litAt(light, brackEye(bPose).x, brackEye(bPose).y, 420);

  const bToLantern = gazeTo(brackEye(bPose), LANTERN.wick, 150);
  const bToPip = gazeTo(brackEye(bPose), {x: 1069, y: 798}, 150);
  const bLook = kf(f, [[1502, 0], [1528, 1], [1592, 1], [1626, 0]], EASE.inOut);
  bPose.gaze = {x: lerp(bToLantern.x, bToPip.x, bLook), y: lerp(bToLantern.y, bToPip.y, bLook)};

  // ── Pip: watches the light he paid for ───────────────────────────────────
  const pPose = pip(f, {
    x: 1068,
    lean: lerp(9, 5, settle),
    headTilt: kf(f, [[1464, 6], [1496, 12], [1552, 4], [1630, 10]], EASE.inOut),
    brow: brow('soft', 'lift', kf(f, [[1530, 0], [1600, 1]], EASE.inOut)),
    mouth: 'smile',
    mouthOpen: 0.2,
    wide: kf(f, [[1464, 0.6], [1560, 0.4], [1660, 0.55]], EASE.inOut),
    blink: blinks(f, [1534, 1616, 1700, 1740]),
    arms: {
      l: hand(1052, 842),
      r: hand(1084, 842),
    },
    legs: {l: {hip: lerp(8, -2, settle), knee: 2}, r: {hip: lerp(-5, 3, settle), knee: 1}},
  });
  pPose.lit = litAt(light, pipEye(pPose).x, pipEye(pPose).y, 420);

  const pToLantern = gazeTo(pipEye(pPose), LANTERN.wick, 170);
  const pToBrack = gazeTo(pipEye(pPose), {x: 1178, y: 694}, 170);
  const pLook = kf(f, [[1514, 0], [1544, 1], [1600, 1], [1632, 0]], EASE.inOut);
  pPose.gaze = {x: lerp(pToLantern.x, pToBrack.x, pLook), y: lerp(pToLantern.y, pToBrack.y, pLook)};

  // The collar crosses from Brack to Pip. Same shape as the hood, the lantern
  // dome and the cupped hands — the fourth and last time that arc appears.
  const cx = kf(f, [[UNWIND, 1160], [1534, 1092], [WRAPPED, 1069]], EASE.inOut);
  const cy = kf(f, [[UNWIND, 708], [1534, 748], [WRAPPED, 772]], EASE.inOut);

  return (
    <Stage f={f} view={view} door={1} lit={lit} wet={0} light={light} rain={1} fog={1}
      dofFar={lerp(24, 0, kf(f, [[1480, 0], [1580, 1]], EASE.soft))}
      dofNear={lerp(34, 5, kf(f, [[1480, 0], [1580, 1]], EASE.soft))}
      grain={0.15}
    >
      <Pip pose={pPose} id="s8p" tuft={false} collar={f >= WRAPPED} ground={GROUND} lightPos={light} />
      <Brack pose={bPose} id="s8b" collar={f < UNWIND + 8} ground={GROUND} lightPos={light} armsFront />
      {f < 1500 ? (
        <g transform={`translate(${kf(f, [[1464, 1240], [1496, 1240]], EASE.linear)} ${kf(f, [[1464, 656], [1496, 650]], EASE.linear)})`}
           opacity={kf(f, [[1464, 1], [TAKES, 0.8], [1494, 0]], EASE.linear)}>
          <Tuft scale={0.9} lit={1} burn={0.85} />
        </g>
      ) : null}
      {f >= UNWIND + 6 && f < WRAPPED ? (
        <g transform={`translate(${cx} ${cy + 105}) scale(0.62) rotate(${lerp(0, -12, unwind)})`} opacity={0.95}>
          <Collar />
        </g>
      ) : null}
    </Stage>
  );
};
