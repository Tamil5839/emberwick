// Final export. FFmpeg takes Remotion's intermediate and produces the
// delivered file: 1920x1080, 24fps, H.264 High, yuv420p, AAC, faststart.

import {execFileSync} from 'node:child_process';
import {existsSync, statSync} from 'node:fs';
import path from 'node:path';

const IN = path.resolve('out/emberwick-intermediate.mp4');
const OUT = path.resolve('out/emberwick.mp4');

if (!existsSync(IN)) {
  console.error('No intermediate found. Run `npm run render` first.');
  process.exit(1);
}

const args = [
  '-y', '-hide_banner', '-loglevel', 'error', '-stats',
  '-i', IN,
  '-vf', 'scale=1920:1080:flags=lanczos:in_range=full:out_range=limited,format=yuv420p',
  '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-r', '24',
  '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1',
  '-preset', 'slow', '-crf', '18',
  '-x264-params', 'ref=4:bframes=3',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
  '-movflags', '+faststart',
  '-metadata', 'title=Emberwick',
  '-metadata', 'comment=A 73-second silent animated short, rendered from code.',
  OUT,
];

console.log('ffmpeg · final encode…');
execFileSync('ffmpeg', args, {stdio: 'inherit'});
const mb = (statSync(OUT).size / 1e6).toFixed(1);
console.log(`\ndone → ${path.relative(process.cwd(), OUT)}  (${mb} MB)`);
