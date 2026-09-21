import {Config} from '@remotion/cli/config';

// Emberwick renders a lot of SVG per frame; these settings keep the draft
// pass fast without giving up the grain and fog that carry the look.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
Config.setConcurrency(null); // let Remotion pick based on cores
