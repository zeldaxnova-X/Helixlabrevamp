/**
 * Helix Labs landing — asset pipeline.
 *
 * Reads the raw assets the team gathered (../ relative to the repo: "3D assets",
 * "Sound asset", "Video assets") and writes web-ready files into public/assets.
 *
 *   node tools/build-assets.mjs            # everything
 *   node tools/build-assets.mjs textures   # one group: textures | models | audio | video | images
 *
 * Tooling lives in tools/node_modules (gltf-transform, sharp, ffmpeg-static) so the
 * site's own dependency tree stays lean. Run `npm i` inside tools/ once.
 *
 * Notes
 * - Textures ship as WebP, not KTX2: KTX2/Basis needs the `toktx` binary which is
 *   not installed on this machine. Swap in `gltf-transform uastc/etc1s` once it is.
 * - The Earth GLB is used as a texture source (day / night-lights / clouds / ocean
 *   mask). Its 3M-vertex mesh is replaced at runtime by a 128-segment sphere and a
 *   custom shader, which looks better and costs a fraction of the GPU memory.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const toolsMods = (m) => require(path.join(here, 'node_modules', m));

const sharp = toolsMods('sharp');
const ffmpeg = toolsMods('ffmpeg-static');
const { NodeIO } = toolsMods('@gltf-transform/core');
const { ALL_EXTENSIONS } = toolsMods('@gltf-transform/extensions');


const RAW = path.resolve(here, '..', '..');
const OUT = path.resolve(here, '..', 'public', 'assets');
const SCRATCH = path.resolve(here, '.cache');
for (const d of [OUT, SCRATCH]) fs.mkdirSync(d, { recursive: true });

const raw = (...p) => path.join(RAW, ...p);
const out = (...p) => {
  const f = path.join(OUT, ...p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  return f;
};
const ff = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
const log = (f) => console.log('  ✓', path.relative(OUT, f), kb(f));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** Pull a texture out of a GLB by material name + slot. */
async function glbTexture(file, materialName, slot) {
  const doc = await io.read(file);
  const mat = doc.getRoot().listMaterials().find((m) => m.getName() === materialName);
  if (!mat) throw new Error(`material ${materialName} not in ${file}`);
  const getter = {
    baseColor: () => mat.getBaseColorTexture(),
    emissive: () => mat.getEmissiveTexture(),
    metallicRoughness: () => mat.getMetallicRoughnessTexture(),
    normal: () => mat.getNormalTexture(),
  }[slot];
  const tex = getter();
  if (!tex) throw new Error(`${materialName}.${slot} missing in ${file}`);
  return Buffer.from(tex.getImage());
}

async function textures() {
  console.log('textures');
  const earth = raw('3D assets', 'Earth', 'earth.glb');
  const day = await glbTexture(earth, 'TERRE', 'baseColor');
  const night = await glbTexture(earth, 'TERRE', 'emissive');
  const clouds = await glbTexture(earth, 'NUAGES', 'baseColor');

  // The Sketchfab source stores these upside-down (its UVs are flipped), so flip.
  // Two tiers: hi (desktop) and lo (mobile / weak GPU).
  for (const [tier, w] of [['hi', 4096], ['lo', 2048]]) {
    let f;
    await sharp(day, { limitInputPixels: false }).flip().resize(w, w / 2).webp({ quality: 82 }).toFile((f = out('textures', `earth-day-${tier}.webp`)));
    log(f);
    await sharp(night, { limitInputPixels: false }).flip().resize(w, w / 2).greyscale().normalise().webp({ quality: 80 }).toFile((f = out('textures', `earth-night-${tier}.webp`)));
    log(f);
    // Clouds: the cloud mask lives in the PNG's alpha channel.
    await sharp(clouds, { limitInputPixels: false }).flip().extractChannel('alpha').resize(w / 2, w / 4).webp({ quality: 78 }).toFile((f = out('textures', `earth-clouds-${tier}.webp`)));
    log(f);
  }
  // (Ocean specular is derived in the shader from the day map's blue dominance —
  // the GLB's roughness map didn't separate land/sea cleanly.)
  let f;
  const moon = await glbTexture(raw('3D assets', 'Moon', 'moon.glb'), 'Material.001', 'baseColor');
  await sharp(moon, { limitInputPixels: false }).resize(2048, 1024).webp({ quality: 80 }).toFile((f = out('textures', 'moon.webp')));
  log(f);
}

async function models() {
  console.log('models');
  // Voyager is the one mesh we ship as-is (it's small and recognisable).
  const cli = path.join(here, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');
  const src = raw('3D assets', 'Space satellite human made', 'voyager satellite.glb');
  const dst = out('models', 'voyager.glb');
  execFileSync(process.execPath, [cli, 'optimize', src, dst, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024'], { stdio: 'inherit' });
  log(dst);
}

async function audio() {
  console.log('audio');
  const S = (...p) => raw('Sound asset', ...p);
  const both = (input, name, extra = [], { mp3 = '128k', opus = '96k' } = {}) => {
    const a = out('audio', `${name}.mp3`);
    const b = out('audio', `${name}.webm`);
    ff(['-i', input, ...extra, '-ac', '2', '-c:a', 'libmp3lame', '-b:a', mp3, a]);
    ff(['-i', input, ...extra, '-ac', '2', '-c:a', 'libopus', '-b:a', opus, b]);
    log(a);
    log(b);
  };

  // Ambient bed: a 64s slice with matching fades, played via Howler loop with a
  // crossfade-friendly tail. Low bitrate — it sits under everything.
  both(S('solarflex-space-ambient-569588.mp3'), 'ambient-bed', ['-ss', '20', '-t', '64', '-af', 'afade=t=in:d=3,afade=t=out:st=60:d=4'], { mp3: '96k', opus: '64k' });
  both(S('impact sound.wav'), 'bigbang-impact', ['-af', 'afade=t=out:st=7:d=2.8']);
  both(S('mixkit-air-woosh-1489.wav'), 'whoosh');

  // Pre-collision riser — synthesised (no library asset was provided):
  // a pitch-swept tone plus band-limited noise that swells over 5s, then hard cut
  // (the hard cut IS the "beat of silence" before impact).
  const riser = path.join(SCRATCH, 'riser.wav');
  ff([
    '-f', 'lavfi', '-i', "aevalsrc='0.35*sin(2*PI*(60*t+ 38*t*t))*(t/5)^2':s=44100:d=5",
    '-f', 'lavfi', '-i', 'anoisesrc=c=pink:d=5:a=0.5',
    '-filter_complex', "[1]highpass=f=900,lowpass=f=7000,volume='(t/5)^3':eval=frame[n];[0][n]amix=inputs=2:normalize=0,aecho=0.6:0.4:60:0.3,afade=t=in:d=1.5",
    riser,
  ]);
  both(riser, 'riser');

  // Earth-arrival resolve — a soft open-fifth chord, synthesised.
  const resolve = path.join(SCRATCH, 'resolve.wav');
  ff([
    '-f', 'lavfi', '-i',
    "aevalsrc='(0.16*sin(2*PI*196*t)+0.12*sin(2*PI*293.66*t)+0.09*sin(2*PI*392*t)+0.05*sin(2*PI*587.3*t))*(1-exp(-3*t))*exp(-0.55*t)':s=44100:d=6",
    '-af', 'aecho=0.8:0.7:120|240:0.35|0.2,afade=t=out:st=4.5:d=1.5',
    resolve,
  ]);
  both(resolve, 'earth-resolve');

  // Per-lab tone beds — very quiet drones, one root per lab, 12s loops.
  const roots = { physics: 110, chemistry: 130.81, biology: 146.83, maths: 164.81 };
  for (const [lab, hz] of Object.entries(roots)) {
    const f = path.join(SCRATCH, `lab-${lab}.wav`);
    ff([
      '-f', 'lavfi', '-i',
      `aevalsrc='(0.12*sin(2*PI*${hz}*t)+0.06*sin(2*PI*${hz * 1.5}*t+sin(2*PI*0.25*t))+0.04*sin(2*PI*${hz * 2.01}*t))*(0.75+0.25*sin(2*PI*t/12))':s=44100:d=12`,
      f,
    ]);
    both(f, `lab-${lab}`, [], { mp3: '64k', opus: '48k' });
  }

  // UI sprite: concatenate short cues with 100ms gaps; emit offsets for Howler.
  const K = (n) => S('kenney_ui-audio', 'Audio', n);
  const cues = [
    ['click', S('mixkit-select-click-1109.wav')],
    ['tick', K('click3.ogg')],
    ['hover', K('rollover2.ogg')],
    ['toggle', K('switch7.ogg')],
    ['bloom', K('switch33.ogg')],
    ['success', K('switch21.ogg')],
    ['release', K('mouserelease1.ogg')],
  ];
  const parts = [];
  const sprite = {};
  let cursor = 0;
  for (const [name, file] of cues) {
    const wav = path.join(SCRATCH, `ui-${name}.wav`);
    ff(['-i', file, '-ac', '2', '-ar', '44100', '-t', '1.2', wav]);
    const ms = Math.round(probeSeconds(wav) * 1000);
    sprite[name] = [cursor, ms];
    parts.push(wav);
    const gap = path.join(SCRATCH, `gap-${name}.wav`);
    ff(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '0.1', gap]);
    parts.push(gap);
    cursor += ms + 100;
  }
  const list = path.join(SCRATCH, 'ui-list.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  const uiWav = path.join(SCRATCH, 'ui-sprite.wav');
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', uiWav]);
  both(uiWav, 'ui-sprite', [], { mp3: '96k', opus: '64k' });
  fs.writeFileSync(out('audio', 'ui-sprite.json'), JSON.stringify(sprite, null, 2));
  console.log('  ✓ audio/ui-sprite.json', sprite);
}

function probeSeconds(file) {
  try {
    execFileSync(ffmpeg, ['-hide_banner', '-i', file], { stdio: 'pipe' });
  } catch (e) {
    const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/);
    if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  }
  return 0.3;
}

async function video() {
  console.log('video');
  const V = (n) => raw('Video assets', n);
  // Mobile scenes are portrait: crop the centre of the 2560x1440 source to 9:16.
  const clips = [
    ['milkyway', 'Night sky with milky way.mp4', 0, 10, 'crop=810:1440:(iw-810)/2-260:0'],
    ['city-night', 'earth night visual.mp4', 2, 9, 'crop=810:1440:(iw-810)/2:0'],
    ['lighthouse', 'earth Lighthouse.mp4', 1, 9, 'crop=810:1440:(iw-810)/2:0'],
    ['city-dusk', 'Earth city visual.mp4', 1, 9, 'crop=810:1440:(iw-810)/2-120:0'],
  ];
  for (const [name, file, ss, t, crop] of clips) {
    const mp4 = out('video', `${name}-portrait.mp4`);
    ff(['-ss', String(ss), '-t', String(t), '-i', V(file), '-an', '-vf', `${crop},scale=540:960,fps=30,format=yuv420p`, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '27', '-maxrate', '1400k', '-bufsize', '2800k', '-movflags', '+faststart', mp4]);
    log(mp4);
    const poster = out('video', `${name}-portrait.jpg`);
    ff(['-ss', String(ss + 1), '-i', V(file), '-vf', `${crop},scale=540:960`, '-frames:v', '1', '-q:v', '5', poster]);
    log(poster);
  }
}

async function images() {
  console.log('images');
  // The HDR is a ground-level night panorama; its sky band makes a strong poster
  // for the flat fallback hero and the social card.
  const tmp = path.join(SCRATCH, 'sky.png');
  ff(['-i', raw('Video assets', 'deep-space_rogland_clear_night_4k.hdr'), '-vf', 'crop=iw*0.62:ih*0.42:iw*0.36:ih*0.02,format=rgb24', tmp]);
  let f;
  await sharp(tmp).resize(1920).modulate({ brightness: 1.15, saturation: 1.1 }).webp({ quality: 78 }).toFile((f = out('images', 'sky-hero.webp')));
  log(f);
  await sharp(tmp).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 80 }).toFile((f = out('images', 'og-sky.jpg')));
  log(f);
}

const groups = { textures, models, audio, video, images };
const pick = process.argv.slice(2);
for (const [name, fn] of Object.entries(groups)) {
  if (pick.length && !pick.includes(name)) continue;
  await fn();
}
console.log('done →', OUT);
