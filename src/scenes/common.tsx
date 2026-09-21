// Shared acting helpers. Each scene is written as a performance: what the eyes
// do, when the pauses fall, and which frame each pose change lands on.
//
// Limbs are aimed at world points rather than posed by angle, so a foot stays
// on the step while the body breathes and a hand can be told to hold a prop.

import {FPS} from '../timing.mjs';
import {clamp, lerp} from '../lib/math';
import {BROW, idleBounce, lookAt} from '../rig/motion';
import {basePose, withPose, type DeepPartial, type Pose} from '../rig/types';
import {BRACK_X, CROUCH_DY, GROUND, PIP_X} from '../world/geometry';
import type {Light} from '../world/Stage';

export const sec = (f: number) => f / FPS;
export const at = (s: number) => s * FPS;

/** How strongly the key light reaches a point. This is what makes the flame
 *  feel like a real source rather than a sticker. */
export function litAt(light: Light | undefined, x: number, y: number, falloff = 340) {
  if (!light || light.i <= 0.01) return 0;
  const d = Math.hypot(x - light.x, y - light.y);
  return clamp(light.i * (1 - d / falloff)) ** 0.85;
}

/** Brack's resting state: breathing, weight settled, feet planted on the step. */
export function brack(f: number, crouch = 0, over: DeepPartial<Pose> = {}): Pose {
  const k = clamp(crouch);
  const idle = idleBounce(f, {rate: 0.0125, amp: 2.6, seed: 4});
  const x = (over.x as number) ?? BRACK_X;
  const p = basePose({
    x,
    y: GROUND + k * CROUCH_DY,
    bob: idle.bob * (1 - k * 0.4),
    squash: idle.squash,
    lean: idle.lean + k * 4,
    brow: BROW.neutral,
    mouth: 'press',
    arms: {
      // Near full extension at rest. A slack two-bone arm has to put its
      // elbow somewhere, and it always chooses somewhere ugly.
      l: {shoulder: 0, elbow: 0, hand: 0, target: {x: x + lerp(-28, -26, k), y: GROUND + lerp(-72, -30, k)}},
      r: {shoulder: 0, elbow: 0, hand: 0, target: {x: x + lerp(28, 32, k), y: GROUND + lerp(-72, -30, k)}},
    },
    legs: {
      l: {hip: 0, knee: 0, target: {x: x + lerp(-13, -2, k), y: GROUND}},
      r: {hip: 0, knee: 0, target: {x: x + lerp(13, 46, k), y: GROUND}},
    },
  });
  return withPose(p, over);
}

/** Pip's resting state: a faster, shallower breath and a permanent slight lift. */
export function pip(f: number, over: DeepPartial<Pose> = {}): Pose {
  const idle = idleBounce(f, {rate: 0.026, amp: 2.2, seed: 12});
  const x = (over.x as number) ?? PIP_X;
  const p = basePose({
    x,
    y: GROUND,
    bob: idle.bob,
    squash: idle.squash,
    lean: idle.lean,
    brow: BROW.neutral,
    mouth: 'small',
    mouthOpen: 0.3,
    arms: {
      l: {shoulder: 0, elbow: 0, hand: 0, target: {x: x - 16, y: GROUND - 2}},
      r: {shoulder: 0, elbow: 0, hand: 0, target: {x: x + 16, y: GROUND - 2}},
    },
    legs: {
      l: {hip: 0, knee: 0, target: {x: x - 9, y: GROUND}},
      r: {hip: 0, knee: 0, target: {x: x + 9, y: GROUND}},
    },
  });
  return withPose(p, over);
}

/** Eye positions, so gazes can be aimed at real world coordinates. */
export const brackEye = (p: Pose) => ({x: p.x + 5, y: p.y + p.bob - 200 + p.headY});
export const pipEye = (p: Pose) => ({x: p.x + 1, y: p.y + p.bob - 45 + p.headY});

export const gazeTo = (eye: {x: number; y: number}, target: {x: number; y: number}, reach = 200) =>
  lookAt(eye, target, reach);

/** Move a hand to a world point, keeping the other channels. */
export const hand = (x: number, y: number) => ({shoulder: 0, elbow: 0, hand: 0, target: {x, y}});
export const foot = (x: number, y: number) => ({hip: 0, knee: 0, target: {x, y}});
