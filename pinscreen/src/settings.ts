// Shared, mutable settings. Every module reads from this one object, so the
// control panel only has to write here.

export type DensityName = 'Low' | 'Medium' | 'High' | 'Insane';

export const DENSITIES: Record<DensityName, { cols: number; rows: number }> = {
  Low: { cols: 80, rows: 60 },
  Medium: { cols: 120, rows: 90 },
  High: { cols: 160, rows: 120 },
  Insane: { cols: 200, rows: 150 },
};

export type FinishName = 'Steel' | 'Brass' | 'Black chrome' | 'White matte';

/** Pin materials. Metals take their colour as specular reflectance (F0). */
export const FINISHES: Record<FinishName, { color: string; metalness: number; roughness: number }> = {
  Steel: { color: '#c9ccd0', metalness: 0.9, roughness: 0.35 },
  Brass: { color: '#d9ae5c', metalness: 0.95, roughness: 0.3 },
  'Black chrome': { color: '#6c7079', metalness: 1, roughness: 0.14 },
  'White matte': { color: '#e9e6df', metalness: 0, roughness: 0.82 },
};

export type SourceName = 'Webcam' | 'Image' | 'Video';

export type FrameName = 'Fill window' | '16:9' | '9:16' | '1:1';
export type RecordFormat = 'MP4' | 'WebM';
export type RecordQuality = 'Standard' | 'High' | 'Max';

/** Output frames. Recording renders at exactly these pixel sizes; "Fill window" records as 16:9. */
export const FRAMES: Record<Exclude<FrameName, 'Fill window'>, { width: number; height: number; label: string }> = {
  '16:9': { width: 1920, height: 1080, label: '16x9' },
  '9:16': { width: 1080, height: 1920, label: '9x16' },
  '1:1': { width: 1080, height: 1080, label: '1x1' },
};

/** Width of the pin field in world units. Kept fixed so every density frames the same. */
export const BOARD_WIDTH = 16;

/** Longest travel the pin geometry is built for; the depth control never exceeds it. */
export const MAX_DEPTH = 2.5;

/** Rows are hex-packed: each row sits sqrt(3)/2 pitch below the last, odd rows shifted half a pitch. */
export const ROW_SPACING = Math.sqrt(3) / 2;

export const settings = {
  source: 'Webcam' as SourceName,
  density: 'Medium' as DensityName,
  finish: 'Steel' as FinishName,

  /** How far a fully bright pin travels out of the board, in world units. */
  depth: 1.0,
  /** Fraction of the remaining distance each pin covers per 60 Hz frame. */
  smoothing: 0.15,
  /** Pins hold their current shape. */
  frozen: false,

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
  /** Slowly swing the key light round the board. */
  autoSweep: false,
  /** Auto-sweep speed in degrees per second. */
  sweepSpeed: 8,
  lightIntensity: 4.2,
  /** Strength of the studio reflections on the metal. */
  environment: 0.9,
  exposure: 1.0,

  /** Optional bokeh pass focused on the orbit target. */
  depthOfField: false,
  /** Depth-of-field strength, 0–1. */
  blur: 0.35,

  /** Output framing: the preview letterboxes to it, and recordings use its exact size. */
  frame: 'Fill window' as FrameName,
  recordFormat: 'MP4' as RecordFormat,
  recordQuality: 'High' as RecordQuality,
  /** Hide every bit of UI, for capturing the window with OBS. */
  cleanMode: false,
};

export type Settings = typeof settings;

const DEFAULTS: Readonly<Settings> = { ...settings };

/** Settings that describe the moment rather than the look, so they're never restored on reload. */
const TRANSIENT: ReadonlySet<keyof Settings> = new Set(['source', 'frozen', 'cleanMode']);
const STORAGE_KEY = 'pinscreen.settings.v1';

/** Restores the saved look, ignoring anything missing, stale or of the wrong type. */
export function loadSettings(): void {
  let saved: Record<string, unknown> | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    return;
  }
  if (!saved || typeof saved !== 'object') return;
  const target = settings as Record<string, unknown>;
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    if (TRANSIENT.has(key) || !(key in saved)) continue;
    if (typeof saved[key] === typeof DEFAULTS[key]) target[key] = saved[key];
  }
  if (!(settings.density in DENSITIES)) settings.density = DEFAULTS.density;
  if (!(settings.finish in FINISHES)) settings.finish = DEFAULTS.finish;
  if (settings.frame !== 'Fill window' && !(settings.frame in FRAMES)) settings.frame = DEFAULTS.frame;
}

export function saveSettings(): void {
  const out: Partial<Record<keyof Settings, unknown>> = {};
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    if (!TRANSIENT.has(key)) out[key] = settings[key];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    // Private mode or blocked storage: the look just won't survive a reload.
  }
}

/** Puts every look setting back to its default (the source and freeze state stay as they are). */
export function resetSettings(): void {
  const target = settings as Record<string, unknown>;
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    if (!TRANSIENT.has(key)) target[key] = DEFAULTS[key];
  }
  saveSettings();
}
