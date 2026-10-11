/**
 * The outer planets, Mars and the black hole: convert the Sketchfab
 * spec-gloss materials to metal-rough, bake ring particle meshes (millions of
 * tiny textured chips) into compact point clouds like Saturn's, then meshopt +
 * WebP everything.
 *
 *   node tools/build-planets.mjs [name…]   → public/assets/models/<name>.glb (+ <name>-rings.bin)
 *
 * Ring .bin format matches tools/bake-saturn-rings.mjs.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const T = (m) => require(path.join(here, 'node_modules', m));
// load sharp before gltf-transform: its dependencies can pull in a second libvips otherwise
const sharp = T('sharp');
const { NodeIO } = T('@gltf-transform/core');
const { ALL_EXTENSIONS } = T('@gltf-transform/extensions');
const { metalRough, textureCompress, meshopt, prune, dedup } = T('@gltf-transform/functions');
const { MeshoptEncoder } = T('meshoptimizer');

const RAW = path.resolve(here, '..', '..', '3D assets');
const OUT = path.resolve(here, '..', 'public', 'assets', 'models');

const JOBS = {
  jupiter: { src: 'Jupiter/jupiter.glb', rings: 'jupiter2_A', keep: 120000, tex: 2048 },
  uranus: { src: 'Uranus/uranus.glb', rings: 'uranus2_A', keep: 160000, tex: 2048 },
  neptune: { src: 'Neptune/neptune.glb', rings: 'neptune2_A', keep: 120000, tex: 2048 },
  mars: { src: 'Mars/mars.glb', rings: null, tex: 2048 },
  blackhole: { src: 'Blackhole/black_hole.glb', rings: null, tex: 1024 },
};

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const mul = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

async function bakeRings(doc, matName, keepN, outFile) {
  const nodes = doc.getRoot().listNodes().filter((n) => n.getMesh()?.listPrimitives().some((p) => p.getMaterial()?.getName() === matName));
  if (!nodes.length) throw new Error('no ring nodes for ' + matName);
  const prim0 = nodes[0].getMesh().listPrimitives().find((p) => p.getMaterial()?.getName() === matName);
  const tex = prim0.getMaterial().getBaseColorTexture();
  // plain decode only: colourspace ops on these textures trip a libvips enum bug
  const { data, info } = await sharp(Buffer.from(tex.getImage())).raw().toBuffer({ resolveWithObject: true });
  const sample = (u, v) => {
    const x = Math.min(info.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * info.width)));
    const y = Math.min(info.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * info.height)));
    const i = (y * info.width + x) * info.channels;
    return info.channels < 3 ? [data[i], data[i], data[i]] : [data[i], data[i + 1], data[i + 2]];
  };
  const pts = [];
  const col = [];
  for (const n of nodes) {
    const m = n.getWorldMatrix();
    for (const prim of n.getMesh().listPrimitives()) {
      if (prim.getMaterial()?.getName() !== matName) continue;
      const P = prim.getAttribute('POSITION');
      const UV = prim.getAttribute('TEXCOORD_0');
      const I = prim.getIndices();
      const tri = I ? I.getCount() / 3 : P.getCount() / 3;
      const a = [], b = [], c = [], ua = [];
      for (let t = 0; t < tri; t++) {
        const i0 = I ? I.getScalar(t * 3) : t * 3;
        P.getElement(i0, a);
        P.getElement(I ? I.getScalar(t * 3 + 1) : t * 3 + 1, b);
        P.getElement(I ? I.getScalar(t * 3 + 2) : t * 3 + 2, c);
        UV.getElement(i0, ua);
        pts.push(mul(m, (a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3));
        col.push(sample(ua[0], ua[1]));
      }
    }
  }
  const idx = pts.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const keep = idx.slice(0, Math.min(keepN, idx.length));
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const i of keep) for (let k = 0; k < 3; k++) (min[k] = Math.min(min[k], pts[i][k])), (max[k] = Math.max(max[k], pts[i][k]));
  const n = keep.length;
  const buf = Buffer.alloc(4 + 24 + n * 6 + n * 3);
  let o = 0;
  buf.writeUInt32LE(n, o); o += 4;
  for (const v of [...min, ...max]) (buf.writeFloatLE(v, o), (o += 4));
  for (const i of keep) for (let k = 0; k < 3; k++) (buf.writeUInt16LE(Math.round(((pts[i][k] - min[k]) / (max[k] - min[k] || 1)) * 65535), o), (o += 2));
  for (const i of keep) for (let k = 0; k < 3; k++) (buf.writeUInt8(col[i][k], o), (o += 1));
  fs.writeFileSync(outFile, buf);
  console.log('  rings', pts.length, 'chips →', n, 'points', (buf.length / 1048576).toFixed(1), 'MB');
  // drop the ring meshes from the glb
  for (const node of nodes) {
    const mesh = node.getMesh();
    for (const prim of mesh.listPrimitives()) if (prim.getMaterial()?.getName() === matName) mesh.removePrimitive(prim);
  }
}

const pick = process.argv.slice(2);
for (const [name, job] of Object.entries(JOBS)) {
  if (pick.length && !pick.includes(name)) continue;
  console.log(name);
  const doc = await io.read(path.join(RAW, job.src));
  await doc.transform(metalRough());
  if (job.rings) await bakeRings(doc, job.rings, job.keep, path.join(OUT, `${name}-rings.bin`));
  await doc.transform(
    prune(),
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [job.tex, job.tex], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const dst = path.join(OUT, `${name}.glb`);
  await io.write(dst, doc);
  console.log('  ✓', dst, (fs.statSync(dst).size / 1048576).toFixed(1), 'MB');
}
