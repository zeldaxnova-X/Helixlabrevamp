/**
 * Phone-sized variants of the heaviest models: same geometry, textures capped
 * so a phone's GPU memory isn't spent on detail its screen can't show.
 *
 *   node tools/build-lo.mjs   → public/assets/models/<name>-lo.glb
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const T = (m) => require(path.join(here, 'node_modules', m));
// sharp first: gltf-transform's dependencies can otherwise load a second libvips
const sharp = T('sharp');
const { NodeIO } = T('@gltf-transform/core');
const { ALL_EXTENSIONS } = T('@gltf-transform/extensions');
const { textureCompress } = T('@gltf-transform/functions');
const { MeshoptDecoder, MeshoptEncoder } = T('meshoptimizer');

const DIR = path.resolve(here, '..', 'public', 'assets', 'models');
const JOBS = { earth: 2048, moon: 1024, mars: 1024 };

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

for (const [name, size] of Object.entries(JOBS)) {
  const doc = await io.read(path.join(DIR, `${name}.glb`));
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 80 }));
  const dst = path.join(DIR, `${name}-lo.glb`);
  await io.write(dst, doc);
  console.log('  ✓', path.basename(dst), (fs.statSync(dst).size / 1048576).toFixed(1), 'MB');
}
