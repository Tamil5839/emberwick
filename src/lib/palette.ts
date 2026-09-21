// The look block, as code. Nothing in the film picks a colour that is not here.
//
//   PALETTE  #0B131C wet slate (dominant ~65%)
//            #1E2E3B mossed stone · #3B5A70 rain-blue (support ~30%)
//            #FFB35C emberlight · #FFE9BE flame core (accent, under 5%)

export const C = {
  // The world — cool, low saturation, value-led.
  nightTop: '#060B12',
  nightLow: '#111E29',
  slate: '#0B131C',
  stone: '#1E2E3B',
  stoneLit: '#2C4152',
  stoneEdge: '#3B5A70',
  rainBlue: '#3B5A70',
  fog: '#4A6B82',
  fogDeep: '#28414F',
  moss: '#1B2A22',
  mossLit: '#2C4234',
  ridge: '#0D1822',

  // The light — the only saturated colour in the film.
  ember: '#FFB35C',
  emberDeep: '#E8792B',
  flameCore: '#FFE9BE',
  emberWash: '#FF9A3C',

  // Brack — waxed canvas, warm-dark so the flame can find him.
  brackBody: '#3A3128',
  brackHood: '#2E2720',
  brackFace: '#4A4034',
  brackCollar: '#63492F',
  brackLimb: '#241E18',

  // Pip — moss, cool-green so he separates from Brack at every value.
  pipBody: '#37472F',
  pipBelly: '#44573C',
  pipTuft: '#8FA285',
  pipTuftDry: '#A8B79C',
  pipLimb: '#1D2A1C',

  // Shared face parts.
  sclera: '#A8B4BD',
  pupil: '#0C141B',
  catchCool: '#D8E4EC',

  black: '#04080C',
} as const;

/** Warm overlay strength as a function of distance from the light. */
export const LIGHT = {
  /** Inner radius of the falloff, in world units, at intensity 1. */
  coreRadius: 190,
  /** Where the warm pool has all but gone. */
  falloffRadius: 760,
} as const;
