import {Composition} from 'remotion';
import {Emberwick} from './Emberwick';
import {DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH} from './timing.mjs';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Emberwick"
    component={Emberwick}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
