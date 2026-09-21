// Shared gradients. Soft edges are done with radial gradients rather than SVG
// blur filters — same look, a fraction of the render cost at 1920x1080.

import {C} from '../lib/palette';

export const Defs: React.FC = () => (
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.12" y2="1">
      <stop offset="0" stopColor={C.nightTop} />
      <stop offset="0.42" stopColor="#0A131C" />
      <stop offset="0.66" stopColor={C.nightLow} />
      <stop offset="1" stopColor="#0A1119" />
    </linearGradient>

    {/* Steep, roughly inverse-square falloff. A broad gradient here was
        lighting the whole background as brightly as the faces. */}
    <radialGradient id="glow-warm">
      <stop offset="0" stopColor={C.flameCore} stopOpacity="0.95" />
      <stop offset="0.10" stopColor={C.ember} stopOpacity="0.52" />
      <stop offset="0.26" stopColor={C.emberWash} stopOpacity="0.17" />
      <stop offset="0.52" stopColor={C.emberWash} stopOpacity="0.045" />
      <stop offset="1" stopColor={C.emberWash} stopOpacity="0" />
    </radialGradient>

    <radialGradient id="glow-core">
      <stop offset="0" stopColor={C.flameCore} stopOpacity="1" />
      <stop offset="0.5" stopColor={C.ember} stopOpacity="0.5" />
      <stop offset="1" stopColor={C.ember} stopOpacity="0" />
    </radialGradient>

    <linearGradient id="tread-0" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stopColor={C.stoneEdge} stopOpacity="0.5" />
      <stop offset="0.55" stopColor={C.stoneEdge} stopOpacity="0.1" />
      <stop offset="1" stopColor={C.black} stopOpacity="0.22" />
    </linearGradient>
    <linearGradient id="tread-1" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stopColor={C.stoneEdge} stopOpacity="0.38" />
      <stop offset="0.55" stopColor={C.stoneEdge} stopOpacity="0.06" />
      <stop offset="1" stopColor={C.black} stopOpacity="0.28" />
    </linearGradient>
    <linearGradient id="parapet" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={C.stoneEdge} stopOpacity="0.2" />
      <stop offset="0.3" stopColor={C.black} stopOpacity="0.28" />
      <stop offset="1" stopColor={C.black} stopOpacity="0.62" />
    </linearGradient>

    <radialGradient id="shadow-soft">
      <stop offset="0" stopColor={C.black} stopOpacity="0.85" />
      <stop offset="0.55" stopColor={C.black} stopOpacity="0.4" />
      <stop offset="1" stopColor={C.black} stopOpacity="0" />
    </radialGradient>

    <radialGradient id="fog-blob">
      <stop offset="0" stopColor={C.fog} stopOpacity="0.5" />
      <stop offset="0.5" stopColor={C.fog} stopOpacity="0.22" />
      <stop offset="1" stopColor={C.fog} stopOpacity="0" />
    </radialGradient>

    <radialGradient id="vignette" cx="0.5" cy="0.47" r="0.72">
      <stop offset="0.38" stopColor="#000000" stopOpacity="0" />
      <stop offset="0.75" stopColor="#000000" stopOpacity="0.32" />
      <stop offset="1" stopColor="#000000" stopOpacity="0.78" />
    </radialGradient>
  </defs>
);
