// The camera. Three of these stacked at different zoom multipliers give real
// parallax: near things magnify more than far ones on a push-in.

import {HEIGHT, WIDTH} from '../timing.mjs';

export type Frame = {cx: number; cy: number; zoom: number};

export const Camera: React.FC<{
  view: Frame;
  /** Depth multiplier. Below 1 is far, above 1 is near. */
  depth?: number;
  blur?: number;
  children: React.ReactNode;
}> = ({view, depth = 1, blur = 0, children}) => {
  const z = view.zoom * depth;
  const tx = WIDTH / 2 - view.cx * z;
  const ty = HEIGHT / 2 - view.cy * z;
  return (
    <g transform={`translate(${tx} ${ty}) scale(${z})`} filter={blur > 0.05 ? `blur(${blur / z}px)` : undefined}>
      {children}
    </g>
  );
};

/** World point -> screen point, for things that must be composited on top. */
export const project = (view: Frame, depth: number, x: number, y: number) => {
  const z = view.zoom * depth;
  return {x: WIDTH / 2 - view.cx * z + x * z, y: HEIGHT / 2 - view.cy * z + y * z, z};
};
