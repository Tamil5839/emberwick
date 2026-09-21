// The stair, as maths. Every scene frames a different part of this one run,
// which is what makes the film feel like a single location rather than a set
// of backdrops. Depth d is the tread index, 0 nearest.

export const VANISH = {x: 1360, y: 452};

/** Hyperbolic falloff — the same compression a real perspective gives. */
export const q = (d: number) => 1 - 1 / (1 + d / 3.2);

export const treadY = (d: number) => 1090 - 640 * q(d);
export const treadCx = (d: number) => 300 + 1180 * q(d);
export const treadW = (d: number) => 760 - 630 * q(d);
export const treadL = (d: number) => treadCx(d) - treadW(d);
export const treadR = (d: number) => treadCx(d) + treadW(d);

/** How far a thing at depth d has receded into the air, 0..1. */
export const haze = (d: number) => Math.min(1, q(d) * 1.15);
/** Everything shrinks with depth. */
export const depthScale = (d: number) => 1 - 0.82 * q(d);

export const TREAD_COUNT = 24;

// ── Staging ─────────────────────────────────────────────────────────────────
// Tread 2 is the landing the whole film happens on. Every position below was
// chosen so the characters can physically reach what they need to reach:
// Brack's arm is 94 units long, Pip's is 33, and nothing in the film asks
// either of them to exceed it.

export const STAGE_D = 2;
export const GROUND = treadY(STAGE_D); // 844

/** Brack drops to a crouch at the tin, and stays down for the rest of the film. */
export const CROUCH_DY = 46;

export const BRACK_X = 1160;
export const PIP_X = 1052;
/** Pip steps in this close to hand the tuft over. */
export const PIP_NEAR_X = 1068;

/** A low stone post — deliberately at Brack's chest height so both of them
 *  can reach it, and so the key light sits between their faces. */
export const LANTERN = {
  x: 1240,
  baseY: GROUND + 4,
  postTop: 700,
  lampY: 636,
  wick: {x: 1240, y: 650},
} as const;

/** Where Brack's hands end up once he is down and sheltering. Both arms are
 *  80 units long and his shoulders are 48 apart, so the only place two hands
 *  can meet without the elbows splaying is low and directly in front of him —
 *  which is also where anyone sheltering a flame from rain would put them. */
export const HANDS = {x: 1152, y: 800};

/** Face centres, used to aim gazes and to frame the close-up. */
export const FACE = {
  brackStanding: {x: BRACK_X + 5, y: GROUND - 197},
  brackCrouched: {x: BRACK_X + 5, y: GROUND + CROUCH_DY - 197},
  pip: {x: PIP_X + 1, y: GROUND - 45},
  pipNear: {x: PIP_NEAR_X + 1, y: GROUND - 45},
  /** The flame, at the catch. */
  flame: {x: 1146, y: 790},
} as const;
