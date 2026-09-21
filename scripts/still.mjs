// Renders single frames for inspection. Bundles once, then renders each frame,
// which makes iterating on a shot fast enough to actually iterate.

import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

const frames = (process.argv[2] ?? '120,400,560,760,950,1120,1235,1480,1700')
  .split(',')
  .map((s) => parseInt(s.trim(), 10));
const outDir = path.resolve('out/stills');
mkdirSync(outDir, {recursive: true});

console.log('bundling…');
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const composition = await selectComposition({serveUrl, id: 'Emberwick'});

for (const frame of frames) {
  const output = path.join(outDir, `f${String(frame).padStart(5, '0')}.png`);
  await renderStill({composition, serveUrl, output, frame, overwrite: true, imageFormat: 'png'});
  console.log('  frame', frame, '→', path.relative(process.cwd(), output));
}
console.log('done');
