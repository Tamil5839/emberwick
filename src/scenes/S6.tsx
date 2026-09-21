// 6 · THE TUFT               00:44.0 – 00:50.0      two-shot, pan down to hands
// One idea: Pip offers, Brack understands what it costs, and takes it anyway.
// The shortest scene in the film, because a decision made is not a scene.

import {EASE, blinks, kf, lerp} from '../lib/math';
import {BRACK_HESITATION, PIP_OFFERING, brow} from '../rig/motion';
import {withPose} from '../rig/types';
import {Stage} from '../world/Stage';
import {Brack} from '../rig/Brack';
import {Pip, Tuft} from '../rig/Pip';
import {Match} from '../world/Props';
import {GROUND, PIP_NEAR_X, PIP_X} from '../world/geometry';
import {brack, brackEye, gazeTo, hand, litAt, pip, pipEye} from './common';
import {flameOf} from './S4';

const HANDOVER = 1186;

export const S6: React.FC<{f: number}> = ({f}) => {
  const view = {
    cx: 1116,
    cy: kf(f, [[1056, 764], [1132, 768], [1196, 790]], EASE.soft),
    zoom: kf(f, [[1056, 3.0], [1132, 3.05], [1196, 3.3]], EASE.soft),
  };

  const burn = kf(f, [[1056, 0.14], [1200, 0.08]], EASE.linear);
  const flame = kf(f, [[1056, 0.24], [1200, 0.3]], EASE.inOut);
  const fl = flameOf(1150, 802, burn);
  const light = {x: fl.x, y: fl.y, r: 240, i: 0.5 * flame};

  // ── Pip: two hops closer, then the offering pose ─────────────────────────
  const offer = kf(f, [[1076, 0], [1112, 1]], EASE.out);
  const nod = kf(f, [[1146, 0], [1153, 1], [1164, 0]], EASE.inOut);
  const px = kf(f, [[1056, PIP_X], [1082, PIP_NEAR_X]], EASE.inOut);
  const hopY = Math.abs(Math.sin((f - 1056) * 0.24)) * (f < 1082 ? -7 : 0);

  let pPose = pip(f, {
    x: px,
    blink: blinks(f, [1066, 1128, 1176]),
    brow: brow('resolve', 'lift', offer),
  });
  pPose = withPose(pPose, {
    lean: lerp(pPose.lean, PIP_OFFERING.lean as number, offer),
    headTilt: lerp(pPose.headTilt, (PIP_OFFERING.headTilt as number) + nod * 9, offer),
    headY: lerp(0, PIP_OFFERING.headY as number, offer),
    squash: lerp(pPose.squash, PIP_OFFERING.squash as number, offer),
    mouth: 'small',
    mouthOpen: lerp(0.2, 0.55, offer),
    wide: lerp(0.35, 0.6, offer),
    arms: {
      l: hand(px - 16, GROUND - 2),
      r: hand(lerp(px + 16, px + 48, offer), lerp(GROUND - 2, GROUND - 48, offer)),
    },
    legs: {l: {hip: lerp(-2, 16, offer), knee: lerp(2, 6, offer)}, r: {hip: lerp(3, -12, offer), knee: lerp(1, 14, offer)}},
  });
  pPose.bob += hopY;
  pPose.gaze = gazeTo(pipEye(pPose), {x: 1172, y: 700}, 150);
  pPose.lit = litAt(light, pipEye(pPose).x, pipEye(pPose).y, 330);

  // ── Brack: the hesitation, then the reach ────────────────────────────────
  const hes = kf(f, [[1096, 0], [1134, 1]], EASE.inOut);
  const take = kf(f, [[1164, 0], [1192, 1]], EASE.inOut);

  let bPose = brack(f, 1, {blink: blinks(f, [1070, 1140, 1190])});
  bPose = withPose(bPose, {
    // He leans toward Pip. He also has to, to be able to reach.
    lean: lerp(4, -3, hes),
    headTilt: lerp(6, BRACK_HESITATION.headTilt as number, hes) + take * 4,
    headY: lerp(0, BRACK_HESITATION.headY as number, hes),
    brow: brow('sad', 'soft', take * 0.7),
    mouth: 'press',
    arms: {
      l: hand(1150, 802),
      r: hand(lerp(1192, 1120, take), lerp(800, 798, take)),
    },
  });
  bPose.lit = litAt(light, brackEye(bPose).x, brackEye(bPose).y, 330);

  // His eyes travel: the tuft, then Pip's bare head, then Pip's eyes.
  const toTuft = gazeTo(brackEye(bPose), {x: 1118, y: 792}, 120);
  const toHead = gazeTo(brackEye(bPose), {x: 1069, y: 772}, 120);
  const toEyes = gazeTo(brackEye(bPose), {x: 1069, y: 800}, 120);
  const g1 = kf(f, [[1120, 0], [1142, 1]], EASE.inOut);
  const g2 = kf(f, [[1148, 0], [1170, 1]], EASE.inOut);
  const m1 = {x: lerp(toTuft.x, toHead.x, g1), y: lerp(toTuft.y, toHead.y, g1)};
  bPose.gaze = {x: lerp(m1.x, toEyes.x, g2), y: lerp(m1.y, toEyes.y, g2)};

  // The tuft: in Pip's hands, then in Brack's.
  const tx = f < HANDOVER ? kf(f, [[1056, 1053], [1112, 1118]], EASE.out) : kf(f, [[HANDOVER, 1118], [1200, 1118]], EASE.inOut);
  const ty = f < HANDOVER ? kf(f, [[1056, 800], [1112, 792]], EASE.out) : kf(f, [[HANDOVER, 792], [1200, 794]], EASE.inOut);

  return (
    <Stage f={f} view={view} door={1} wet={1} light={light} rain={0.9} fog={1} dofFar={13} dofNear={22} grain={0.16}>
      <Pip pose={pPose} id="s6p" tuft={false} ground={GROUND} lightPos={light} />
      <Brack pose={bPose} id="s6b" ground={GROUND} lightPos={light} armsFront />
      <Match x={1150} y={802} f={f} angle={-34} burn={burn} flame={flame} />
      <g transform={`translate(${tx} ${ty}) rotate(${kf(f, [[1056, 4], [1112, -6], [1200, -2]], EASE.inOut)})`}>
        <Tuft scale={0.92} lit={pPose.lit * 0.7} />
      </g>
    </Stage>
  );
};
