// Stage assembles the world for a given camera frame. Every scene calls this
// with a view, a light, and its characters — which is how eight different
// framings stay recognisably the same place.

import {AbsoluteFill} from 'remotion';
import {HEIGHT, WIDTH} from '../timing.mjs';
import {Camera, project, type Frame} from './Camera';
import {Defs} from './Defs';
import {ForegroundLayer, SkyLayer, StairLayer} from './Stair';
import {Lantern} from './Lantern';
import {CoolWash, Fog, Grain, Rain, Splashes, Vignette, WarmKey} from './Atmosphere';
import {GROUND, treadL, treadR} from './geometry';
import {C} from '../lib/palette';

export type Light = {x: number; y: number; r: number; i: number};

export const Stage: React.FC<{
  f: number;
  view: Frame;
  light?: Light;
  door?: number;
  lit?: number;
  wet?: number;
  rain?: number;
  fog?: number;
  dofFar?: number;
  dofNear?: number;
  grain?: number;
  vignette?: number;
  /** Extra night pressed into everything before the key light goes back on.
   *  Defaults to a value derived from the lens: the longer the lens, the less
   *  of the world the small flame can possibly reach. */
  darken?: number;
  /** Drawn in world space, in the midground, between the stair and the rain. */
  children?: React.ReactNode;
  /** Drawn in world space above everything in the midground. */
  above?: React.ReactNode;
}> = ({
  f,
  view,
  light,
  door = 0,
  lit = 0,
  wet = 0,
  rain = 1,
  fog = 1,
  dofFar = 0,
  dofNear = 0,
  grain = 0.15,
  vignette = 1,
  darken,
  children,
  above,
}) => {
  const key = light && light.i > 0.005 ? project(view, 1, light.x, light.y) : null;
  // A tight lens magnifies the background but not the light falling on it.
  const tight = Math.max(0, Math.min(1, (view.zoom - 1.5) / 2.9));
  const dark = darken ?? tight * 0.62;
  const fogEff = fog / (1 + tight * 1.6);
  const vig = vignette * (1 + tight * 0.55);

  return (
    <AbsoluteFill style={{backgroundColor: C.black}}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{display: 'block'}}>
        <Defs />

        {/* far — sky, ridge, the dark lanterns, the fog they sit in */}
        <Camera view={view} depth={0.86} blur={dofFar}>
          {/* only the hero lantern ever burns — the rest of the stair stays dark */}
          <SkyLayer lit={0} />
          <Fog f={f} seed={2} count={8} band={[430, 700]} opacity={fogEff * 0.85} />
          <Rain f={f} seed={11} count={150} area={{x: -500, y: -200, w: 3000, h: 1600}} len={26} speed={13} width={1} opacity={rain * 0.16} />
        </Camera>

        {/* mid — the stair, the lantern, the two of them */}
        <Camera view={view} depth={1}>
          <StairLayer />
          <Fog f={f} seed={5} count={5} band={[620, 900]} opacity={fogEff * 0.4} />
          <Lantern f={f} door={door} lit={lit} wet={wet} />
          {children}
          <Splashes f={f} y={GROUND} x0={treadL(2)} x1={treadR(2)} count={30} opacity={rain * 0.26} />
          <Rain f={f} seed={23} count={190} area={{x: -500, y: -300, w: 3000, h: 1700}} len={46} speed={26} width={1.5} opacity={rain * 0.26} />
          {above}
        </Camera>

        {/* near — what the lens is looking past */}
        <Camera view={view} depth={1.24} blur={dofNear}>
          <ForegroundLayer />
          <Rain f={f} seed={37} count={90} area={{x: -700, y: -400, w: 3400, h: 1900}} len={86} speed={46} width={3} opacity={rain * 0.2} tilt={-0.24} />
        </Camera>

        {/* the grade: cool everything, then put the one warm source back */}
        <CoolWash strength={1 - lit * 0.35} />
        {dark > 0.005 ? <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#03070B" opacity={dark} /> : null}
        {key ? <WarmKey x={key.x} y={key.y} r={light!.r * key.z} intensity={light!.i} f={f} /> : null}
        <Vignette strength={vig} />
      </svg>
      <Grain f={f} opacity={grain} />
    </AbsoluteFill>
  );
};
