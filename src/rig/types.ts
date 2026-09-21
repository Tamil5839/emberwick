// One rig, two characters. Brack and Pip differ only in their skin — the pose
// vocabulary below is shared, so every animation helper works on both.

/** Angles are a fallback; when `target` is set the rig solves for it instead.
 *  Targets are in WORLD coordinates, so a planted foot stays planted while the
 *  body breathes, and a hand can be aimed at a prop. */
export type Arm = {shoulder: number; elbow: number; hand: number; target?: {x: number; y: number} | null};
export type Leg = {hip: number; knee: number; target?: {x: number; y: number} | null};
export type Mouth = 'flat' | 'small' | 'smile' | 'frown' | 'open' | 'oh' | 'press' | 'wobble';

export interface Pose {
  /** World position of the character's feet. */
  x: number;
  y: number;
  scale: number;
  flip: boolean;

  /** Vertical offset from idle bounce or the walk cycle. Negative is up. */
  bob: number;
  /** 1 is neutral; above 1 stretches, below 1 squashes. */
  squash: number;
  /** Body lean, in degrees. Positive leans toward screen right. */
  lean: number;

  headTilt: number;
  /** -1 turned away, 0 neutral, 1 turned toward screen right. */
  headTurn: number;
  headY: number;

  /** Pupil offset, -1..1 in each axis. This is most of the acting. */
  gaze: {x: number; y: number};
  /** 0 open, 1 closed. */
  blink: number;
  /** Eyes opened beyond neutral. Used once, at the catch. */
  wide: number;

  brow: {l: {y: number; a: number}; r: {y: number; a: number}};

  mouth: Mouth;
  mouthOpen: number;

  arms: {l: Arm; r: Arm};
  legs: {l: Leg; r: Leg};

  /** 0 cool night, 1 full warm key. Drives the eye catchlights and skin warmth. */
  lit: number;
}

export function basePose(over: Partial<Pose> = {}): Pose {
  return {
    x: 0,
    y: 0,
    scale: 1,
    flip: false,
    bob: 0,
    squash: 1,
    lean: 0,
    headTilt: 0,
    headTurn: 0,
    headY: 0,
    gaze: {x: 0, y: 0},
    blink: 0,
    wide: 0,
    brow: {l: {y: 0, a: 0}, r: {y: 0, a: 0}},
    mouth: 'flat',
    mouthOpen: 0,
    arms: {l: {shoulder: 6, elbow: 10, hand: 0}, r: {shoulder: -6, elbow: -10, hand: 0}},
    legs: {l: {hip: 0, knee: 0}, r: {hip: 0, knee: 0}},
    lit: 0,
    ...over,
  };
}

/** Deep-merge a partial pose over another. Used to layer acting onto a walk. */
export function withPose(base: Pose, over: DeepPartial<Pose>): Pose {
  return {
    ...base,
    ...over,
    gaze: {...base.gaze, ...over.gaze},
    brow: {
      l: {...base.brow.l, ...over.brow?.l},
      r: {...base.brow.r, ...over.brow?.r},
    },
    arms: {
      l: {...base.arms.l, ...over.arms?.l},
      r: {...base.arms.r, ...over.arms?.r},
    },
    legs: {
      l: {...base.legs.l, ...over.legs?.l},
      r: {...base.legs.r, ...over.legs?.r},
    },
  } as Pose;
}

export type DeepPartial<T> = {[K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]};
