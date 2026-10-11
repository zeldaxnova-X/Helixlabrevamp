/**
 * HD variants for capable GPUs, from the 8K sources:
 *   earth-hd.glb   day map 8192×4096, night lights / clouds / surface 4096×2048
 *   moon.glb       4096×2048 (was 2048)
 *   milkyway-sky-hd.webp  8192×4096 star sky (the dome spans 360°, so it needs it)
 *
 *   node tools/build-hd.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const T = (m) => require(path.join(here, 'node_modules', m));
const sharp = T('sharp'); // first: see build-planets.mjs
const { NodeIO } = T('@gltf-transform/core');
const { ALL_EXTENSIONS } = T('@gltf-transform/extensions');
const { meshopt, prune, dedup } = T('@gltf-transform/functions');
const { MeshoptDecoder, MeshoptEncoder } = T('meshoptimizer');

const RAW = path.resolve(here, '..', '..', '3D assets');
const OUT = path.resolve(here, '..', 'public', 'assets');
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

/** Resize each texture to the width `sizeOf(texture)` returns, as WebP. */
async function textures(doc, sizeOf, quality = 86) {
  for (const t of doc.getRoot().listTextures()) {
    const w = sizeOf(t);
    const img = await sharp(Buffer.from(t.getImage()), { limitInputPixels: false }).resize(w, w / 2).webp({ quality }).toBuffer();
    t.setImage(new Uint8Array(img)).setMimeType('image/webp');
  }
}

async function model(src, dst, sizeOf) {
  const doc = await io.read(path.join(RAW, src));
  await doc.transform(prune(), dedup());
  await textures(doc, sizeOf);
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(dst, doc);
  console.log('  ✓', path.basename(dst), (fs.statSync(dst).size / 1048576).toFixed(1), 'MB');
}

// Earth: only the day map (what you actually see) at full 8K
await model('Earth/earth.glb', path.join(OUT, 'models', 'earth-hd.glb'), (t) => {
  const usedAsDayMap = t.listParents().some((p) => p.propertyType === 'Material' && p.getName() === 'TERRE' && p.getBaseColorTexture() === t);
  return usedAsDayMap ? 8192 : 4096;
});
await model('Moon/moon.glb', path.join(OUT, 'models', 'moon.glb'), () => 4096);

const sky = path.join(OUT, 'textures', 'milkyway-sky-hd.webp');
await sharp(path.join(RAW, 'Milkyway asset', '8k_stars_milky_way.jpg'), { limitInputPixels: false }).webp({ quality: 86 }).toFile(sky);
console.log('  ✓', path.basename(sky), (fs.statSync(sky).size / 1048576).toFixed(1), 'MB');
