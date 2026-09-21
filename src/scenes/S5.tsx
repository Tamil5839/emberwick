// 5 · PIP DECIDES            00:36.5 – 00:44.0      close on Pip, dead still
// One idea: Pip works out what he has that would burn.
//
// The centre of this scene is 36 frames — a second and a half — in which
// nothing moves at all. The idle bounce is switched off, the blinks stop, and
// the rain drops 8dB in the mix. It is the only full stop in the film.

import {EASE, blinks, kf} from '../lib/math';
import {brow} from '../rig/motion';
import {Stage} from '../world/Stage';
import {Brack} from '../rig/Brack';
import {Pip, Tuft} from '../rig/Pip';
import {Match} from '../world/Props';
import {brack, brackEye, gazeTo, hand, litAt, pip, pipEye} from './common';
import {GROUND} from '../world/geometry';
import {flameOf} from './S4';

const STILL_IN = 934;
const STILL_OUT = 970;
const PULL = 1019;

export const S5: React.FC<{f: number}> = ({f}) => {
  // Pip is a quarter of Brack's height; at 3.3x he was still the smaller
  // thing in his own close-up.
  const view = {cx: 1039, cy: 812, zoom: 4.4};

  const burn = kf(f, [[876, 0.3], [1056, 0.14]], EASE.linear);
  const flame = kf(f, [[876, 0.46], [930, 0.36], [986, 0.3], [1056, 0.24]], EASE.inOut);
  const hx = 1150;
  const hy = 802;
  const fl = flameOf(hx, hy, burn);
  const light = {x: fl.x, y: fl.y, r: 250, i: 0.5 * flame};

  // Brack is mostly out of frame — a pair of cupped hands and a dying light.
  const bPose = brack(f, 1, {
    lean: 4,
    headTilt: 6,
    brow: brow('alarm', 'sad', kf(f, [[900, 0], [960, 1]], EASE.inOut)),
    mouth: 'press',
    blink: blinks(f, [904, 1004]),
    arms: {l: hand(hx, hy), r: hand(1192, 800)},
  });
  bPose.lit = litAt(light, brackEye(bPose).x, brackEye(bPose).y, 330);
  bPose.gaze = gazeTo(brackEye(bPose), fl, 120);

  // ── Pip's performance ────────────────────────────────────────────────────
  const still = f >= STILL_IN && f <= STILL_OUT;
  const hold = kf(f, [[PULL, 0], [1040, 1]], EASE.out);

  let pPose = pip(f, {
    lean: kf(f, [[876, 10], [930, 3], [1040, 5]], EASE.inOut),
    headTilt: kf(f, [[876, 4], [912, 10], [934, 2], [984, -4], [1022, 6], [1050, 10]], EASE.inOut),
    brow: brow(f < 940 ? 'worry' : 'sad', 'resolve', kf(f, [[988, 0], [1022, 1]], EASE.inOut)),
    mouth: f > 1024 ? 'press' : f > 934 ? 'flat' : 'oh',
    mouthOpen: kf(f, [[876, 0.9], [930, 0.4], [1056, 0]], EASE.inOut),
    blink: blinks(f, [890, 918, 1034], 4) + blinks(f, [972], 10),
    wide: kf(f, [[876, 0.8], [934, 0.2], [1022, 0.35]], EASE.inOut),
    // Both hands go to his own head, find the tuft, and pull.
    arms: {
      l: hand(
        kf(f, [[876, 1036], [982, 1036], [1014, 1045], [PULL, 1043], [1042, 1045]], EASE.inOut),
        kf(f, [[876, 842], [982, 842], [1014, 784], [PULL, 790], [1042, 796]], EASE.inOut)
      ),
      r: hand(
        kf(f, [[876, 1068], [982, 1068], [1014, 1061], [PULL, 1063], [1042, 1061]], EASE.inOut),
        kf(f, [[876, 842], [982, 842], [1014, 784], [PULL, 790], [1042, 796]], EASE.inOut)
      ),
    },
  });

  // The stop: no breath, no sway, no blink. Just a small creature thinking.
  if (still) pPose = {...pPose, bob: -1.2, squash: 1, lean: 3};

  const toFlame = gazeTo(pipEye(pPose), fl, 170);
  const toBrack = gazeTo(pipEye(pPose), {x: 1165, y: 693}, 170);
  const ahead = {x: -0.06, y: 0.22};
  const toTuft = gazeTo(pipEye(pPose), {x: 1053, y: 792}, 120);
  const a = kf(f, [[908, 0], [934, 1]], EASE.inOut);   // flame -> Brack's face
  const b = kf(f, [[936, 0], [950, 1]], EASE.inOut);   // -> nothing at all
  const c = kf(f, [[1022, 0], [1044, 1]], EASE.inOut); // -> the tuft in his hands
  const g1 = {x: toFlame.x + (toBrack.x - toFlame.x) * a, y: toFlame.y + (toBrack.y - toFlame.y) * a};
  const g2 = {x: g1.x + (ahead.x - g1.x) * b, y: g1.y + (ahead.y - g1.y) * b};
  pPose.gaze = {x: g2.x + (toTuft.x - g2.x) * c, y: g2.y + (toTuft.y - g2.y) * c};
  pPose.lit = litAt(light, pipEye(pPose).x, pipEye(pPose).y, 330);

  const tuftX = kf(f, [[PULL, 1053], [1040, 1053]], EASE.out);
  const tuftY = kf(f, [[PULL, 774], [1026, 760], [1044, 790]], EASE.inOut);

  return (
    <Stage f={f} view={view} door={1} wet={1} light={light} rain={1} fog={1} dofFar={16} dofNear={28} grain={0.16}>
      <Pip pose={pPose} id="s5p" tuft={f < PULL} ground={GROUND} lightPos={light} />
      <Brack pose={bPose} id="s5b" ground={GROUND} lightPos={light} armsFront />
      <Match x={hx} y={hy} f={f} angle={-34} burn={burn} flame={flame} />
      {f >= PULL ? (
        <g transform={`translate(${tuftX} ${tuftY}) rotate(${kf(f, [[PULL, -8], [1044, 6]], EASE.out)})`} opacity={0.4 + hold * 0.6}>
          <Tuft scale={0.9} lit={pPose.lit * 0.6} />
        </g>
      ) : null}
    </Stage>
  );
};
