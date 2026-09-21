// A flame: a teardrop, a hotter core, and a bloom. Flicker comes from layered
// value noise, so it is organic and still identical on every render.

import {C} from '../lib/palette';
import {fbm} from '../lib/math';

export const Flame: React.FC<{
  x: number;
  y: number;
  size: number;
  f: number;
  seed?: number;
  opacity?: number;
  /** 0 struggling, 1 steady. Drives how much the flame is thrown around. */
  steady?: number;
}> = ({x, y, size, f, seed = 3, opacity = 1, steady = 1}) => {
  const chaos = 1.9 - steady * 1.4;
  const h = 1 + fbm(f * 0.36, seed) * 0.16 * chaos;
  const w = 1 - fbm(f * 0.41, seed + 11) * 0.1 * chaos;
  const sway = fbm(f * 0.23, seed + 23) * 0.3 * chaos;
  const s = size;

  const tear = (k: number) =>
    `M 0 0
     C ${-s * 0.55 * w * k} ${-s * 0.35 * h * k}, ${-s * 0.34 * w * k} ${-s * 1.1 * h * k}, ${sway * s * k} ${-s * 1.75 * h * k}
     C ${s * 0.34 * w * k} ${-s * 1.1 * h * k}, ${s * 0.55 * w * k} ${-s * 0.35 * h * k}, 0 0 Z`;

  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <g style={{mixBlendMode: 'screen'}}>
        <circle cy={-s * 0.7} r={s * 3.4} fill="url(#glow-warm)" opacity={0.26} />
        <circle cy={-s * 0.6} r={s * 1.5} fill="url(#glow-core)" opacity={0.55} />
      </g>
      <path d={tear(1)} fill={C.emberDeep} opacity={0.95} />
      <path d={tear(0.72)} fill={C.ember} />
      <path d={tear(0.38)} fill={C.flameCore} />
    </g>
  );
};
