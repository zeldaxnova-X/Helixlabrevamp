/**
 * HD encodes of the footage, from the 2560×1440 sources:
 *   wide clips  → 1920×1080, CRF 20 (desktop, full screen)
 *   portrait    → 810×1440 native centre crop, CRF 21 (phones)
 *
 *   node tools/build-video-hd.mjs   → public/assets/video/*
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const ffmpeg = require(path.join(here, 'node_modules', 'ffmpeg-static'));
const RAW = path.resolve(here, '..', '..', 'Video assets');
const OUT = path.resolve(here, '..', 'public', 'assets', 'video');
const ff = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const mb = (f) => (fs.statSync(f).size / 1048576).toFixed(1) + ' MB';

const x264 = (crf, maxrate) => ['-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', String(crf), '-maxrate', maxrate, '-bufsize', '12M', '-g', '60', '-movflags', '+faststart', '-an'];

// [output, source, start, seconds]
const WIDE = [
  ['nightsky-wide', 'Night sky with milky way.mp4', 1, 9],
  ['lighthouse-wide', 'earth Lighthouse.mp4', 2, 12],
  ['citynight-card', 'earth night visual.mp4', 2, 10],
  ['citydusk-card', 'Earth city visual.mp4', 1, 11],
];
// [output, source, start, seconds, crop]
const TALL = [
  ['milkyway-portrait', 'Night sky with milky way.mp4', 0, 10, 'crop=810:1440:(iw-810)/2-260:0'],
  ['city-night-portrait', 'earth night visual.mp4', 2, 9, 'crop=810:1440:(iw-810)/2:0'],
  ['lighthouse-portrait', 'earth Lighthouse.mp4', 1, 9, 'crop=810:1440:(iw-810)/2:0'],
  ['city-dusk-portrait', 'Earth city visual.mp4', 1, 9, 'crop=810:1440:(iw-810)/2-120:0'],
];

const pick = process.argv.slice(2);
for (const [name, file, ss, t] of WIDE) {
  if (pick.length && !pick.includes(name)) continue;
  const mp4 = path.join(OUT, `${name}.mp4`);
  ff(['-ss', String(ss), '-t', String(t), '-i', path.join(RAW, file), '-vf', 'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p', ...x264(20, '7M'), mp4]);
  ff(['-ss', String(ss + 1), '-i', path.join(RAW, file), '-vf', 'scale=1920:1080:flags=lanczos', '-frames:v', '1', '-q:v', '3', path.join(OUT, `${name}.jpg`)]);
  console.log('  ✓', name, mb(mp4));
}
for (const [name, file, ss, t, crop] of TALL) {
  if (pick.length && !pick.includes(name)) continue;
  const mp4 = path.join(OUT, `${name}.mp4`);
  ff(['-ss', String(ss), '-t', String(t), '-i', path.join(RAW, file), '-vf', `${crop},fps=30,format=yuv420p`, ...x264(21, '5M'), mp4]);
  ff(['-ss', String(ss + 1), '-i', path.join(RAW, file), '-vf', crop, '-frames:v', '1', '-q:v', '3', path.join(OUT, `${name}.jpg`)]);
  console.log('  ✓', name, mb(mp4));
}
