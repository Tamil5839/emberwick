// 1 · THE DROWNED STAIR      00:00.0 – 00:10.0      wide, very slow push-in
// One idea: this place is cold, it is raining, and every lantern is out.

import {EASE, inv, seg} from '../lib/math';
import {Stage} from '../world/Stage';
import {Droplet} from '../world/Props';
import {LANTERN, treadL, treadY} from '../world/geometry';

export const S1: React.FC<{f: number}> = ({f}) => {
  const t = f;
  const view = {cx: 960, cy: 560, zoom: seg(t, 0, 240, 1.0, 1.06, EASE.soft)};

  return (
    <Stage
      f={f}
      view={view}
      rain={1}
      fog={1}
      dofNear={5}
      wet={0.55}
      grain={0.17}
      above={
        <>
          {/* the stair is so wet it drips even where nothing is burning */}
          <Droplet x={LANTERN.x - 40} y={LANTERN.lampY + 62} t={inv(62, 96, t)} fall={140} />
          <Droplet x={treadL(4) + 18} y={treadY(4) - 118} t={inv(142, 180, t)} fall={104} />
          <Droplet x={LANTERN.x + 52} y={LANTERN.lampY + 58} t={inv(206, 240, t)} fall={146} />
        </>
      }
    />
  );
};
