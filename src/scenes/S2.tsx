// 2 · TWO KEEPERS            00:10.0 – 00:19.0      medium-wide, locked off
// One idea: these two have come here on purpose, and the purpose is the lantern.
//
// Brack takes one long step every 0.62s and Pip cannot keep up at that size, so
// Pip bounds. Both cycles are driven off absolute seconds, which is the same
// clock the footsteps in the score are scheduled on.

import {EASE, blinks, kf} from '../lib/math';
import {hopCycle, walkCycle, BROW, brow} from '../rig/motion';
import {withPose} from '../rig/types';
import {Stage} from '../world/Stage';
import {Brack} from '../rig/Brack';
import {Pip} from '../rig/Pip';
import {LANTERN, treadY} from '../world/geometry';
import {brack, brackEye, gazeTo, pip, pipEye, sec} from './common';

const WICK = {x: LANTERN.x, y: LANTERN.wick.y};

export const S2: React.FC<{f: number}> = ({f}) => {
  const s = sec(f);
  const view = {cx: 1120, cy: 680, zoom: 1.15};

  // ── Brack: eight steps up, then he stops and looks at what he came for ────
  const bWalking = f > 246 && f < 366;
  const bPhase = (s - 10.4) / 1.24;
  const bx = kf(f, [[249.6, 424], [352.6, 1136], [366, 1160]], EASE.linear);
  const by = kf(f, [[240, 1090], [291, 1090], [295, treadY(1)], [336, treadY(1)], [340, treadY(2)], [456, treadY(2)]], EASE.inOut);

  const bLook = kf(f, [[366, 0], [392, 1]], EASE.out);
  let bPose = brack(f, 0, {
    x: bx,
    y: by,
    headTilt: kf(f, [[366, 0], [396, -4]], EASE.out),
    brow: brow('neutral', 'soft', bLook),
    blink: blinks(f, [268, 320, 382, 428]),
  });
  if (bWalking) bPose = withPose(bPose, {...walkCycle(bPhase, 1, {stride: 25, knee: 34, swing: 18, bob: 5}), lean: 4});
  bPose.gaze = gazeTo(brackEye(bPose), WICK, 210);

  // ── Pip: two bounds for every one of Brack's steps ────────────────────────
  const pWalking = f > 250 && f < 374;
  const pPhase = (s - 10.56) / 0.62;
  const px = kf(f, [[253, 330], [356, 1030], [374, 1052]], EASE.linear);
  const py = kf(f, [[240, 1090], [289, 1090], [293, treadY(1)], [332, treadY(1)], [336, treadY(2)], [456, treadY(2)]], EASE.inOut);

  let pPose = pip(f, {
    x: px,
    y: py,
    headTilt: kf(f, [[376, 0], [404, 11], [430, 11], [444, 3]], EASE.out),
    brow: BROW.lift,
    mouth: 'small',
    mouthOpen: kf(f, [[376, 0.3], [404, 0.75]], EASE.out),
    blink: blinks(f, [274, 310, 372, 412, 448]),
  });
  if (pWalking) pPose = withPose(pPose, {...hopCycle(pPhase, 1.25), lean: 6});

  // Pip looks at the lantern, then up at Brack to check, then back.
  const toLantern = gazeTo(pipEye(pPose), WICK, 190);
  const toBrack = gazeTo(pipEye(pPose), {x: bPose.x + 5, y: bPose.y - 200}, 190);
  const check = kf(f, [[418, 0], [432, 1], [446, 1], [456, 0]], EASE.inOut);
  pPose.gaze = {
    x: toLantern.x + (toBrack.x - toLantern.x) * check,
    y: toLantern.y + (toBrack.y - toLantern.y) * check,
  };

  return (
    <Stage f={f} view={view} rain={1} fog={1} wet={0.55} dofNear={4} grain={0.16}>
      <Pip pose={pPose} id="s2p" />
      <Brack pose={bPose} id="s2b" />
    </Stage>
  );
};
