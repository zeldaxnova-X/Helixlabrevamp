/**
 * Bake Saturn's ring particles (the 3.2M-vertex "saturn2_A" mesh in saturn.glb:
 * ~1M individual textured chips) into a compact point cloud: one point per chip
 * at its true position, coloured by sampling the ring texture at the chip's UV.
 *
 *   node tools/bake-saturn-rings.mjs            → public/assets/models/saturn-rings.bin
 *
 * Format (little-endian):
 *   header  : u32 count, f32 min[3], f32 max[3]
 *   position: count × 3 × u16  (quantised into [min, max])
 *   colour  : count × 3 × u8
 * Positions are in the model's root space, same as saturn.glb.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { NodeIO } = require(path.join(here, 'node_modules/@gltf-transform/core'));
const { ALL_EXTENSIONS } = require(path.join(here, 'node_modules/@gltf-transform/extensions'));
const sharp = require(path.join(here, 'node_modules/sharp'));

const SRC = path.join(here, '.cache', 'sat-mr.glb'); // metal-rough conversion of the original
const OUT = path.resolve(here, '..', 'public', 'assets', 'models', 'saturn-rings.bin');
const KEEP = Number(process.argv[2] ?? 520000);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);
const nodes = doc.getRoot().listNodes().filter((n) => n.getName() === 'Saturn2_B_saturn2_A_0');

// ring texture → raw RGB
const mat = nodes[0].getMesh().listPrimitives()[0].getMaterial();
const tex = mat.getBaseColorTexture();
const img = sharp(Buffer.from(tex.getImage()));
const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
const sample = (u, v) => {
  const x = Math.min(info.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * info.width)));
  const y = Math.min(info.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * info.height)));
  const i = (y * info.width + x) * 3;
  return [data[i], data[i + 1], data[i + 2]];
};

const pts = [];
const col = [];
const mul = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
for (const n of nodes) {
  const m = n.getWorldMatrix();
  const prim = n.getMesh().listPrimitives()[0];
  const P = prim.getAttribute('POSITION');
  const T = prim.getAttribute('TEXCOORD_0');
  const I = prim.getIndices();
  const tri = I ? I.getCount() / 3 : P.getCount() / 3;
  const a = [], b = [], c = [], ua = [];
  for (let t = 0; t < tri; t++) {
    const i0 = I ? I.getScalar(t * 3) : t * 3;
    const i1 = I ? I.getScalar(t * 3 + 1) : t * 3 + 1;
    const i2 = I ? I.getScalar(t * 3 + 2) : t * 3 + 2;
    P.getElement(i0, a);
    P.getElement(i1, b);
    P.getElement(i2, c);
    T.getElement(i0, ua);
    pts.push(mul(m, (a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3));
    col.push(sample(ua[0], ua[1]));
  }
}
console.log('chips', pts.length);

// keep an even random subset
const idx = pts.map((_, i) => i);
for (let i = idx.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [idx[i], idx[j]] = [idx[j], idx[i]];
}
const keep = idx.slice(0, Math.min(KEEP, idx.length));
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (const i of keep) for (let k = 0; k < 3; k++) (min[k] = Math.min(min[k], pts[i][k])), (max[k] = Math.max(max[k], pts[i][k]));

const n = keep.length;
const buf = Buffer.alloc(4 + 24 + n * 6 + n * 3);
let o = 0;
buf.writeUInt32LE(n, o); o += 4;
for (const v of [...min, ...max]) (buf.writeFloatLE(v, o), (o += 4));
for (const i of keep)
  for (let k = 0; k < 3; k++) (buf.writeUInt16LE(Math.round(((pts[i][k] - min[k]) / (max[k] - min[k] || 1)) * 65535), o), (o += 2));
for (const i of keep) for (let k = 0; k < 3; k++) (buf.writeUInt8(col[i][k], o), (o += 1));
fs.writeFileSync(OUT, buf);
console.log('wrote', OUT, (buf.length / 1048576).toFixed(1), 'MB', n, 'points', { min, max });
