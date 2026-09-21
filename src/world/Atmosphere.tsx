// Rain, fog, the warm key, the cool wash, grain and vignette.
// All procedural, all deterministic, all a pure function of the frame.

import {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {C} from '../lib/palette';
import {fbm, hash, rng} from '../lib/math';
import {HEIGHT, WIDTH} from '../timing.mjs';

// ── Rain ────────────────────────────────────────────────────────────────────
// One <path> per layer instead of hundreds of <line>s. Three layers at
// different speeds and scales give the depth.

export const Rain: React.FC<{
  f: number;
  seed: number;
  count: number;
  area: {x: number; y: number; w: number; h: number};
  len: number;
  speed: number;
  tilt?: number;
  width?: number;
  opacity?: number;
  color?: string;
}> = ({f, seed, count, area, len, speed, tilt = -0.2, width = 1.4, opacity = 0.3, color = C.rainBlue}) => {
  const drops = useMemo(() => {
    const r = rng(seed);
    return Array.from({length: count}, () => ({
      x: area.x + r() * area.w,
      p: r(),
      l: len * (0.6 + r() * 0.8),
      v: speed * (0.82 + r() * 0.36),
      o: 0.45 + r() * 0.55,
    }));
  }, [seed, count, area.x, area.w, len, speed]);

  const d = drops
    .map((dr) => {
      const span = area.h + dr.l;
      const y = area.y - dr.l + (((dr.p + (f * dr.v) / span) % 1) + 1) % 1 * span;
      return `M${dr.x.toFixed(1)} ${y.toFixed(1)}l${(dr.l * tilt).toFixed(1)} ${dr.l.toFixed(1)}`;
    })
    .join('');

  return <path d={d} stroke={color} strokeWidth={width} strokeLinecap="round" opacity={opacity} fill="none" />;
};

/** Rain hitting stone: brief bright ticks on the landing. */
export const Splashes: React.FC<{f: number; y: number; x0: number; x1: number; count?: number; opacity?: number}> = ({
  f,
  y,
  x0,
  x1,
  count = 26,
  opacity = 0.3,
}) => {
  const items = [];
  for (let i = 0; i < count; i++) {
    const cycle = 26 + hash(i, 5) * 30;
    const t = ((f + hash(i, 9) * cycle) % cycle) / cycle;
    if (t > 0.34) continue;
    const k = t / 0.34;
    const x = x0 + hash(i, 17) * (x1 - x0);
    const yy = y + (hash(i, 23) - 0.5) * 26;
    items.push(
      <ellipse key={i} cx={x} cy={yy} rx={3 + k * 16} ry={1 + k * 3.4} fill="none" stroke={C.stoneEdge} strokeWidth={1.2} opacity={(1 - k) * opacity} />
    );
  }
  return <g>{items}</g>;
};

// ── Fog ─────────────────────────────────────────────────────────────────────

export const Fog: React.FC<{f: number; seed?: number; count?: number; opacity?: number; band?: [number, number]}> = ({
  f,
  seed = 2,
  count = 9,
  opacity = 1,
  band = [420, 760],
}) => {
  const blobs = useMemo(() => {
    const r = rng(seed);
    return Array.from({length: count}, () => ({
      x: -400 + r() * 2800,
      y: band[0] + r() * (band[1] - band[0]),
      rx: 340 + r() * 520,
      ry: 70 + r() * 130,
      v: 0.16 + r() * 0.34,
      o: 0.3 + r() * 0.6,
      s: r() * 100,
    }));
  }, [seed, count, band[0], band[1]]);

  return (
    <g opacity={opacity} style={{mixBlendMode: 'screen'}}>
      {blobs.map((b, i) => (
        <ellipse
          key={i}
          cx={((b.x + f * b.v + 600) % 3400) - 600}
          cy={b.y + fbm(f * 0.006 + b.s, i + 3) * 22}
          rx={b.rx}
          ry={b.ry}
          fill="url(#fog-blob)"
          opacity={b.o * (0.55 + 0.45 * fbm(f * 0.01 + b.s, i + 40))}
        />
      ))}
    </g>
  );
};

// ── Light ───────────────────────────────────────────────────────────────────
// A single warm key, screened over the world, plus a cool multiply that pushes
// everything the flame does not reach back into the night.

export const WarmKey: React.FC<{x: number; y: number; r: number; intensity: number; f?: number}> = ({
  x,
  y,
  r,
  intensity,
  f = 0,
}) => {
  if (intensity <= 0.005) return null;
  const flick = 1 + fbm(f * 0.3, 77) * 0.07;
  return (
    <g style={{mixBlendMode: 'screen'}}>
      <circle cx={x} cy={y} r={r * flick} fill="url(#glow-warm)" opacity={0.55 * intensity} />
      <circle cx={x} cy={y} r={r * 0.34 * flick} fill="url(#glow-core)" opacity={0.5 * intensity} />
    </g>
  );
};

export const CoolWash: React.FC<{strength?: number}> = ({strength = 1}) => (
  <rect
    x={-700}
    y={-500}
    width={3400}
    height={2200}
    fill={C.fogDeep}
    opacity={0.18 * strength}
    style={{mixBlendMode: 'multiply'}}
  />
);

export const Vignette: React.FC<{strength?: number}> = ({strength = 1}) => (
  <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="url(#vignette)" opacity={strength} />
);

// ── Grain ───────────────────────────────────────────────────────────────────
// A 128px noise tile generated once, then jittered per frame. Cheap, and it
// looks like film rather than like video noise.

let grainURL: string | null = null;
function grainTile() {
  if (grainURL) return grainURL;
  const n = 128;
  const cv = document.createElement('canvas');
  cv.width = n;
  cv.height = n;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(n, n);
  const r = rng(1234);
  for (let i = 0; i < n * n; i++) {
    const v = 118 + (r() - 0.5) * 150;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainURL = cv.toDataURL();
  return grainURL;
}

export const Grain: React.FC<{f: number; opacity?: number; size?: number}> = ({f, opacity = 0.16, size = 300}) => {
  const url = useMemo(() => grainTile(), []);
  const dx = Math.floor(hash(f, 3) * size);
  const dy = Math.floor(hash(f, 91) * size);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${url})`,
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: `${dx}px ${dy}px`,
        mixBlendMode: 'overlay',
        opacity: opacity * (0.85 + hash(f, 7) * 0.3),
        pointerEvents: 'none',
      }}
    />
  );
};
