// Renders the film. Remotion draws the frames and encodes a high-bitrate
// intermediate; scripts/export.mjs then runs it through FFmpeg for the
// delivered 1920x1080 MP4.

import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {existsSync, mkdirSync} from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('out/emberwick-intermediate.mp4');
mkdirSync(path.resolve('out'), {recursive: true});

if (!existsSync(path.resolve('public/emberwick-mix.wav'))) {
  console.error('No soundtrack found. Run `npm run audio` first.');
  process.exit(1);
}

console.log('bundling…');
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const composition = await selectComposition({serveUrl, id: 'Emberwick'});
console.log(`rendering ${composition.durationInFrames} frames @ ${composition.fps}fps · ${composition.width}x${composition.height}`);

let lastPct = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  crf: 12,
  outputLocation: OUT,
  imageFormat: 'jpeg',
  jpegQuality: 98,
  chromiumOptions: {gl: 'angle'},
  onProgress: ({renderedFrames, encodedFrames}) => {
    const pct = Math.floor((renderedFrames / composition.durationInFrames) * 100);
    if (pct !== lastPct && pct % 5 === 0) {
      lastPct = pct;
      process.stdout.write(`  ${String(pct).padStart(3)}%  rendered ${renderedFrames} · encoded ${encodedFrames}\n`);
    }
  },
});
console.log(`done → ${path.relative(process.cwd(), OUT)}`);
