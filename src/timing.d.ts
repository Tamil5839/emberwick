declare module '*/timing.mjs' {
  export const FPS: number;
  export const WIDTH: number;
  export const HEIGHT: number;
  export const DURATION_IN_FRAMES: number;
  export const SCENES: {id: number; key: string; title: string; start: number; dur: number}[];
  export const T: Record<string, {in: number; out: number}>;
}
