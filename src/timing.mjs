// Single source of truth for the film's timeline.
// Imported by both the Remotion compositions (TS) and the audio score (JS),
// so picture and sound can never drift apart.

export const FPS = 24;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** @typedef {{id:number,key:string,title:string,start:number,dur:number}} Scene */

/** @type {Scene[]} */
export const SCENES = [
  {id: 1, key: 'establish', title: 'The drowned stair',  start: 0,    dur: 240},
  {id: 2, key: 'arrival',   title: 'Two keepers',        start: 240,  dur: 216},
  {id: 3, key: 'problem',   title: 'The wick is wet',    start: 456,  dur: 168},
  {id: 4, key: 'lastmatch', title: 'One match',          start: 624,  dur: 252},
  {id: 5, key: 'decision',  title: 'Pip decides',        start: 876,  dur: 180},
  {id: 6, key: 'gift',      title: 'The tuft',           start: 1056, dur: 144},
  {id: 7, key: 'climax',    title: 'It catches',         start: 1200, dur: 264},
  {id: 8, key: 'payoff',    title: 'Emberwick',          start: 1464, dur: 288},
];

export const DURATION_IN_FRAMES = SCENES.reduce((n, s) => Math.max(n, s.start + s.dur), 0);

/** Scene start/end in seconds — the audio score works in seconds. */
export const T = Object.fromEntries(
  SCENES.map((s) => [s.key, {in: s.start / FPS, out: (s.start + s.dur) / FPS}])
);
