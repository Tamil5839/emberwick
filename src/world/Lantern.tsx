// The hero lantern. Its door opens, its wick is drowned, and in the last
// twelve seconds it becomes the only thing in the frame that matters.

import {C} from '../lib/palette';
import {LANTERN} from './geometry';
import {Flame} from './Flame';

export const Lantern: React.FC<{
  f: number;
  /** 0 shut, 1 fully open. */
  door?: number;
  /** 0 dead, 1 burning. */
  lit?: number;
  /** A bead of water hanging off the wick. */
  wet?: number;
}> = ({f, door = 0, lit = 0, wet = 0}) => {
  const {x, lampY, baseY, postTop} = LANTERN;
  const fold = Math.cos((door * 78 * Math.PI) / 180);

  return (
    <g>
      {/* post */}
      <path d={`M ${x - 7} ${baseY} L ${x - 4.5} ${postTop} L ${x + 4.5} ${postTop} L ${x + 7} ${baseY} Z`} fill={C.stone} />
      <path d={`M ${x - 6} ${baseY} L ${x - 3.8} ${postTop}`} stroke={C.stoneEdge} strokeWidth={1.4} opacity={0.3} />
      {[0.25, 0.55, 0.82].map((t, i) => (
        <rect key={i} x={x - 9} y={baseY + (postTop - baseY) * t} width={18} height={5} rx={2} fill={C.slate} />
      ))}
      <ellipse cx={x} cy={baseY + 3} rx={26} ry={7} fill={C.stone} />

      <g transform={`translate(${x} ${lampY})`}>
        {/* cap — the cupped arc again, turned over */}
        <path d="M -54 -38 C -48 -70, -22 -80, 0 -80 C 22 -80, 48 -70, 54 -38 Z" fill={C.stone} />
        <path d="M -54 -38 C -48 -70, -22 -80, 0 -80 C 22 -80, 48 -70, 54 -38" fill="none" stroke={C.stoneEdge} strokeWidth={1.6} opacity={0.35} />
        <rect x={-4} y={-92} width={8} height={14} rx={3} fill={C.stone} />
        <circle cy={-94} r={5} fill={C.stone} />

        {/* housing */}
        <path d="M -40 -38 L -36 44 L 36 44 L 40 -38 Z" fill={C.slate} />
        {/* the glass, which is nothing but a hole in the night until it isn't */}
        <path d="M -34 -32 L -31 38 L 31 38 L 34 -32 Z" fill={C.black} opacity={0.92} />
        {lit > 0.01 ? (
          <path d="M -34 -32 L -31 38 L 31 38 L 34 -32 Z" fill={C.ember} opacity={lit * 0.85} style={{mixBlendMode: 'screen'}} />
        ) : null}

        {/* wick tray and the wick itself */}
        <rect x={-11} y={26} width={22} height={6} rx={2} fill={C.stone} />
        <rect x={-2} y={8} width={4} height={20} rx={2} fill={lit > 0.3 ? C.emberDeep : '#241C16'} />
        {wet > 0.02 ? (
          <ellipse cx={0} cy={9 + wet * 2} rx={4.2 * wet} ry={5.4 * wet} fill={C.stoneEdge} opacity={0.75 * wet} />
        ) : null}
        {lit > 0.02 ? <Flame x={0} y={10} size={16} f={f} seed={91} opacity={lit} steady={lit} /> : null}

        {/* frame bars, drawn over the glass */}
        {[-34, -12, 12, 34].map((bx, i) => (
          <path key={i} d={`M ${bx} -34 L ${bx * 0.92} 40`} stroke={C.stone} strokeWidth={4} />
        ))}
        <rect x={-42} y={40} width={84} height={12} rx={3} fill={C.stone} />
        <rect x={-46} y={50} width={92} height={7} rx={3} fill={C.slate} />

        {/* the door, hinged at its left edge and foreshortened as it opens */}
        <g transform={`translate(-34 0) scale(${fold} 1)`}>
          <path d="M 0 -32 L 2 38 L 66 38 L 68 -32 Z" fill={C.slate} opacity={0.5} />
          <path d="M 0 -32 L 2 38 L 66 38 L 68 -32 Z" fill="none" stroke={C.stone} strokeWidth={5} />
          <path d="M 34 -32 L 34 38" stroke={C.stone} strokeWidth={3} />
        </g>
        {door > 0.05 ? <rect x={-38} y={-34} width={5} height={74} rx={2} fill={C.stone} /> : null}

        {lit > 0.02 ? (
          <g style={{mixBlendMode: 'screen'}} opacity={lit}>
            <circle cy={6} r={210} fill="url(#glow-warm)" opacity={0.5} />
            <circle cy={6} r={78} fill="url(#glow-core)" opacity={0.55} />
          </g>
        ) : null}
      </g>

      {/* the light finding the wet stone underneath */}
      {lit > 0.02 ? (
        <g style={{mixBlendMode: 'screen'}} opacity={lit * 0.5}>
          <ellipse cx={x} cy={baseY + 2} rx={150} ry={22} fill="url(#glow-warm)" />
          <rect x={x - 26} y={lampY + 60} width={52} height={baseY - lampY - 56} fill="url(#glow-core)" opacity={0.22} />
        </g>
      ) : null}
    </g>
  );
};
