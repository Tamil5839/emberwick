// Shared, mutable settings. Every module reads from this one object, so the
// control panel only has to write here.

export type DensityName = 'Low' | 'Medium' | 'High' | 'Insane';

export const DENSITIES: Record<DensityName, { cols: number; rows: number }> = {
  Low: { cols: 80, rows: 60 },
  Medium: { cols: 120, rows: 90 },
  High: { cols: 160, rows: 120 },
  Insane: { cols: 200, rows: 150 },
};

/** Width of the pin field in world units. Kept fixed so every density frames the same. */
export const BOARD_WIDTH = 16;

/** Longest travel the pin geometry is built for; the depth control never exceeds it. */
export const MAX_DEPTH = 2.5;

/** Rows are hex-packed: each row sits sqrt(3)/2 pitch below the last, odd rows shifted half a pitch. */
export const ROW_SPACING = Math.sqrt(3) / 2;

export const settings = {
  density: 'Medium' as DensityName,

  /** How far a fully bright pin travels out of the board, in world units. */
  depth: 1.0,
  /** Fraction of the remaining distance each pin covers per 60 Hz frame. */
  smoothing: 0.15,

  /** Stretch the frame's darkest and brightest pixels to the full pin range. */
  autoLevels: true,
  contrast: 1.35,
  /** Mid-tone gamma: above 1 pushes mid-greys out, below 1 pulls them in. */
  gamma: 1.0,
  invert: false,

  /** Key light height above the board plane, in degrees. Low = long raking shadows. */
  lightElevation: 13,
  /** Direction the key light comes from, in degrees (0 = right, 90 = top, 180 = left). */
  lightAzimuth: 150,
  lightIntensity: 4.2,
  /** Strength of the studio reflections on the metal. */
  environment: 0.9,
  exposure: 1.0,
};

export type Settings = typeof settings;
