// The motion vocabulary: idle bounce, walk cycle, gaze, and the two emotional
// poses the storyboard calls for. All of it is shared between both characters.

import {TAU, fbm, clamp} from '../lib/math';
import type {DeepPartial, Pose} from './types';

/** Brow presets. Inner-end up reads as worry; inner-end down reads as resolve. */
export const BROW = {
  neutral: {l: {y: 0, a: 0}, r: {y: 0, a: 0}},
  worry: {l: {y: -1, a: -16}, r: {y: -1, a: 16}},
  sad: {l: {y: 2, a: -22}, r: {y: 2, a: 22}},
  alarm: {l: {y: -5, a: -7}, r: {y: -5, a: 7}},
  resolve: {l: {y: 2, a: 12}, r: {y: 2, a: -12}},
  soft: {l: {y: -1, a: -7}, r: {y: -1, a: 7}},
  lift: {l: {y: -6, a: -2}, r: {y: -6, a: 2}},
  squint: {l: {y: 3, a: 6}, r: {y: 3, a: -6}},
} as const;

export type BrowName = keyof typeof BROW;

/** Blend between two brow presets — lets an expression change over frames. */
export function brow(a: BrowName, b: BrowName = a, t = 0) {
  const A = BROW[a];
  const B = BROW[b];
  const m = (x: number, y: number) => x + (y - x) * clamp(t);
  return {
    l: {y: m(A.l.y, B.l.y), a: m(A.l.a, B.l.a)},
    r: {y: m(A.r.y, B.r.y), a: m(A.r.a, B.r.a)},
  };
}

/**
 * Breathing. Every character is always doing this, which is the difference
 * between a drawing that is alive and one that is paused.
 */
export function idleBounce(f: number, o: {rate?: number; amp?: number; phase?: number; seed?: number} = {}) {
  const {rate = 0.016, amp = 2.4, phase = 0, seed = 1} = o;
  const s = Math.sin(f * rate * TAU + phase);
  return {
    bob: -amp * (0.5 + 0.5 * s),
    squash: 1 + s * 0.012 + fbm(f * 0.018, seed) * 0.006,
    lean: fbm(f * 0.009, seed + 31) * 1.3,
  };
}

/**
 * Two-segment walk. `phase` 0 and 0.5 are foot contacts, which is where the
 * footsteps in the score fall — picture and sound are locked by construction.
 */
export function walkCycle(
  phase: number,
  amt = 1,
  o: {stride?: number; knee?: number; swing?: number; bob?: number; elbow?: number} = {}
): DeepPartial<Pose> {
  const p = ((phase % 1) + 1) % 1;
  const a = p * TAU;
  const stride = (o.stride ?? 27) * amt;
  const kneeAmt = (o.knee ?? 36) * amt;
  const swing = (o.swing ?? 21) * amt;
  const bobAmt = (o.bob ?? 4.5) * amt;
  const rest = o.elbow ?? 10;

  const sa = Math.sin(a);
  const sb = Math.sin(a + Math.PI);

  return {
    bob: -bobAmt * sa * sa,
    // Targets are cleared: a walk is angle-driven, not aimed at anything.
    legs: {
      l: {hip: stride * sa, knee: kneeAmt * Math.max(0, Math.sin(a + 1.9)), target: null},
      r: {hip: stride * sb, knee: kneeAmt * Math.max(0, Math.sin(a + Math.PI + 1.9)), target: null},
    },
    arms: {
      l: {shoulder: -swing * sa, elbow: rest + 7 * Math.max(0, -sa), hand: 0, target: null},
      r: {shoulder: -swing * sb, elbow: -rest - 7 * Math.max(0, -sb), hand: 0, target: null},
    },
  };
}

/** Pip does not walk so much as commute by bouncing. */
export function hopCycle(phase: number, amt = 1): DeepPartial<Pose> {
  const base = walkCycle(phase, amt, {stride: 22, knee: 30, swing: 16, bob: 3, elbow: 16});
  const p = ((phase % 1) + 1) % 1;
  const a = p * TAU;
  const lift = Math.abs(Math.sin(a)) ** 1.6;
  return {
    ...base,
    bob: (base.bob ?? 0) - 5.5 * lift,
    squash: 1 + 0.07 * lift - 0.05 * (1 - lift),
  };
}

/** Point the pupils at a world coordinate, with a soft limit. */
export function lookAt(
  eye: {x: number; y: number},
  target: {x: number; y: number},
  reach = 190
): {x: number; y: number} {
  const dx = (target.x - eye.x) / reach;
  const dy = (target.y - eye.y) / reach;
  const m = Math.hypot(dx, dy);
  const k = m > 1 ? 1 / m : 1;
  return {x: clamp(dx * k, -1, 1), y: clamp(dy * k, -1, 1)};
}

/** Interpolate two gaze targets. */
export function mixGaze(a: {x: number; y: number}, b: {x: number; y: number}, t: number) {
  const k = clamp(t);
  return {x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k};
}

// ── The two emotional poses ─────────────────────────────────────────────────

/**
 * BRACK · "the hesitation". Scene 6, the beat where he is offered something he
 * knows costs Pip more than it costs him. Arms drawn in, head lowered, brows
 * lifted at the inner ends.
 */
export const BRACK_HESITATION: DeepPartial<Pose> = {
  lean: -12,
  headTilt: -5,
  headY: 5,
  squash: 0.985,
  brow: BROW.sad,
  mouth: 'press',
  mouthOpen: 0,
  arms: {
    l: {shoulder: 26, elbow: 52, hand: -12},
    r: {shoulder: -34, elbow: -58, hand: 10},
  },
  legs: {l: {hip: -3, knee: 4}, r: {hip: 4, knee: 2}},
};

/**
 * PIP · "the offering". One arm stretched out toward Brack at full extension,
 * body leaning after it, head tilted back to find his eyes. Both arms up would
 * be prettier, but Pip's arms are 33 units and his shoulders are 50 apart, so
 * anything he holds in two hands sits under his own chin where nobody can see
 * it. One arm puts the tuft out in the open, against Brack's dark cloak.
 */
export const PIP_OFFERING: DeepPartial<Pose> = {
  lean: 7,
  headTilt: 8,
  headY: -3,
  squash: 1.05,
  brow: BROW.lift,
  mouth: 'small',
  mouthOpen: 0.5,
  arms: {
    l: {shoulder: -14, elbow: 18, hand: 0},
    r: {shoulder: -74, elbow: -16, hand: 0},
  },
  legs: {l: {hip: 16, knee: 6}, r: {hip: -12, knee: 14}},
};

// ── Inverse kinematics ──────────────────────────────────────────────────────
// Posing limbs by guessing angles produced arms that pointed the wrong way, so
// limbs are aimed at a point instead: scenes name where a hand or a foot should
// be in world space and the rig works out the joint angles.

const DEG = 180 / Math.PI;

/** Two-bone IK. Angles are local: 0 points straight down, positive is toward
 *  screen left. `bend` picks which side the joint breaks toward. */
export function solveLimb(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  l1: number,
  l2: number,
  bend: 1 | -1
): {a: number; b: number} {
  const dx = tx - sx;
  const dy = ty - sy;
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const base = Math.atan2(-dx, dy);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const B = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
  return {a: (base + bend * A) * DEG, b: -bend * (Math.PI - B) * DEG};
}

/** World point into a character's own coordinates, undoing position and lean. */
export function toLocal(p: {x: number; y: number; bob: number; scale: number; lean: number}, wx: number, wy: number) {
  const ux = (wx - p.x) / p.scale;
  const uy = (wy - (p.y + p.bob)) / p.scale;
  const r = (-p.lean * Math.PI) / 180;
  return {x: ux * Math.cos(r) - uy * Math.sin(r), y: ux * Math.sin(r) + uy * Math.cos(r)};
}
