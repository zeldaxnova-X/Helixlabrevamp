import { BEATS, type Vec3 } from './beats';

/**
 * Flattens every beat's local camera keys into one global track and evaluates it
 * with a time-parameterised cubic Hermite spline.
 *
 * Why not CatmullRomCurve3: that parameterises by key index, so a 6%-of-scroll
 * flight across 300 units and a 3%-of-scroll nudge of 1 unit would move at the
 * same "speed". Here tangents are finite differences over *global progress*, so
 * velocity is continuous across beats, and `hold` keys get a zero tangent so the
 * camera eases to a stop (Act II parks). A limiter stops overshoot where
 * neighbouring segments differ wildly in length (the universe pull-back).
 */

interface Key {
  t: number;
  pos: Vec3;
  look: Vec3;
  fov: number;
  roll: number;
  hold: boolean;
  cut: boolean;
  smooth: boolean;
}

function buildKeys(): Key[] {
  const keys: Key[] = [];
  let lastFov = 40;
  let lastRoll = 0;
  for (const beat of BEATS) {
    const [a, b] = beat.range;
    for (const k of beat.camera) {
      lastFov = k.fov ?? lastFov;
      lastRoll = k.roll ?? 0;
      keys.push({ t: a + k.at * (b - a), pos: k.pos, look: k.look, fov: lastFov, roll: lastRoll, hold: !!k.hold, cut: !!k.cut, smooth: !!k.smooth });
    }
  }
  keys.sort((x, y) => x.t - y.t);
  // Pin the ends.
  keys[0]!.hold = true;
  keys[keys.length - 1]!.hold = true;
  return keys;
}

const KEYS = buildKeys();

type Channel = 'pos' | 'look';

function tangent(i: number, ch: Channel, axis: number): number {
  const k = KEYS[i]!;
  if (k.hold) return 0;
  const prev = KEYS[i - 1];
  const next = KEYS[i + 1];
  if (!prev || !next) return 0;
  const m = (next[ch][axis]! - prev[ch][axis]!) / (next.t - prev.t);
  // dense curve samples: the curve is already smooth, keep its true velocity
  if (k.smooth) return m;
  // Limiter: never let the tangent carry more than 1.2× either neighbouring chord.
  const lim = (dv: number, dt: number) => (Math.abs(dv) / dt) * 1.2;
  const l1 = lim(k[ch][axis]! - prev[ch][axis]!, k.t - prev.t);
  const l2 = lim(next[ch][axis]! - k[ch][axis]!, next.t - k.t);
  const cap = Math.min(l1, l2);
  // If the key is a local extremum on this axis, flatten it (no overshoot).
  if (Math.sign(k[ch][axis]! - prev[ch][axis]!) !== Math.sign(next[ch][axis]! - k[ch][axis]!)) return 0;
  return Math.max(-cap, Math.min(cap, m));
}

// Precompute tangents per key / channel / axis.
const TAN = KEYS.map((_, i) => ({
  pos: [0, 1, 2].map((a) => tangent(i, 'pos', a)),
  look: [0, 1, 2].map((a) => tangent(i, 'look', a)),
}));

export interface CameraSample {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
  roll: number;
}

export function sampleCamera(p: number, out: CameraSample): CameraSample {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1]!.t) i++;
  const k0 = KEYS[i]!;
  const k1 = KEYS[i + 1] ?? k0;
  const dt = Math.max(1e-6, k1.t - k0.t);
  // a cut key: stay on the previous key until its time, then jump (never glide between worlds)
  const u = k1.cut ? (p < k1.t ? 0 : 1) : Math.min(1, Math.max(0, (p - k0.t) / dt));
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  for (const ch of ['pos', 'look'] as const) {
    for (let a = 0; a < 3; a++) {
      out[ch][a] = h00 * k0[ch][a]! + h10 * dt * TAN[i]![ch][a]! + h01 * k1[ch][a]! + h11 * dt * TAN[i + 1]![ch][a]!;
    }
  }
  const s = u * u * (3 - 2 * u);
  out.fov = k0.fov + (k1.fov - k0.fov) * s;
  out.roll = k0.roll + (k1.roll - k0.roll) * s;
  return out;
}
