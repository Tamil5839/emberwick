// 3 · THE WICK IS WET        00:19.0 – 00:26.0      medium, slight push-in
// One idea: the problem. Brack opens the lantern and water comes out of it.

import {EASE, blinks, inv, kf, seg} from '../lib/math';
import {brow} from '../rig/motion';
import {Stage} from '../world/Stage';
import {Brack} from '../rig/Brack';
import {Pip} from '../rig/Pip';
import {Droplet} from '../world/Props';
import {LANTERN} from '../world/geometry';
import {brack, brackEye, gazeTo, hand, pip, pipEye} from './common';
import {GROUND} from '../world/geometry';

export const S3: React.FC<{f: number}> = ({f}) => {
  const view = {cx: 1230, cy: 640, zoom: seg(f, 456, 624, 1.55, 1.68, EASE.soft)};
  const door = kf(f, [[468, 0], [496, 1]], EASE.out);

  const worry = kf(f, [[516, 0], [550, 1]], EASE.inOut);
  const bPose = brack(f, 0, {
    lean: kf(f, [[456, 0], [472, 5], [530, 1]], EASE.inOut),
    headTilt: kf(f, [[456, -4], [500, -2], [540, 4]], EASE.inOut),
    brow: brow('soft', 'worry', worry),
    mouth: f > 536 ? 'frown' : 'press',
    blink: blinks(f, [498, 554, 606]),
    arms: {
      l: hand(1136, 748),
      r: hand(
        kf(f, [[456, 1183], [476, 1212], [506, 1212], [532, 1183]], EASE.inOut),
        kf(f, [[456, 748], [476, 626], [506, 626], [532, 748]], EASE.inOut)
      ),
    },
  });
  bPose.gaze = gazeTo(brackEye(bPose), LANTERN.wick, 150);

  // Pip watches the lantern, then goes looking for Brack's face to find out
  // how bad it is. That travel is the whole performance of this scene.
  const pPose = pip(f, {
    headTilt: kf(f, [[456, 6], [536, 8], [576, 14]], EASE.inOut),
    brow: brow('lift', 'worry', kf(f, [[556, 0], [586, 1]], EASE.inOut)),
    mouth: 'small',
    mouthOpen: kf(f, [[456, 0.7], [540, 0.7], [576, 0.25]], EASE.inOut),
    blink: blinks(f, [476, 534, 594]),
  });
  const toLantern = gazeTo(pipEye(pPose), LANTERN.wick, 190);
  const toBrack = gazeTo(pipEye(pPose), {x: bPose.x + 5, y: bPose.y - 200}, 190);
  const travel = kf(f, [[536, 0], [576, 1]], EASE.inOut);
  pPose.gaze = {
    x: toLantern.x + (toBrack.x - toLantern.x) * travel,
    y: toLantern.y + (toBrack.y - toLantern.y) * travel,
  };

  return (
    <Stage f={f} view={view} door={door} wet={1} rain={1} fog={1} dofNear={9} dofFar={3} grain={0.16}
      above={<Droplet x={LANTERN.x + 2} y={LANTERN.lampY + 64} t={inv(512, 548, f)} fall={142} />}
    >
      <Pip pose={pPose} id="s3p" ground={GROUND} />
      <Brack pose={bPose} id="s3b" ground={GROUND} />
    </Stage>
  );
};
