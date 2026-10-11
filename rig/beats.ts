/**
 * THE BEATS CONFIG — the single file that defines the journey.
 *
 * Scroll is a 0..1 timeline. Each beat owns a slice and declares:
 *   - range       [start, end] in global progress
 *   - camera      keyframes in *local* beat time (0..1). `hold` keys get zero
 *                 tangent so the camera eases to a stop there.
 *   - narration   the one line shown over the 3D (from content/site.ts)
 *   - hud         the small mono caption bottom-left (what you're looking at)
 *   - cue         audio cue fired when the beat is entered moving forward
 *   - chapter     which chapter of the rail it belongs to
 *
 * The world is a line of "stations" the camera flies through, mostly along −Z:
 * Earth (the hero) at the origin, then the space cloud, Voyager, the Milky Way,
 * the Sun, Saturn, the Moon and, at the far end, Earth again,
 * where the STEM chapter happens. Scenes mount only while the camera is near
 * them (SCENES below).
 *
 * To retune the journey you should only need to edit this file.
 */
import { NARRATION } from '@/content/site';

export type Vec3 = readonly [number, number, number];

export interface CameraKey {
  at: number;
  pos: Vec3;
  look: Vec3;
  fov?: number;
  /** Camera roll in radians (bank), interpolated like fov. */
  roll?: number;
  hold?: boolean;
  /** Jump straight to this key at its time (no glide from the previous one). */
  cut?: boolean;
  /** Part of a densely sampled curve: plain central-difference tangent, no flattening. */
  smooth?: boolean;
}

export type CueId = 'whoosh' | 'riser' | 'impact' | 'resolve' | 'silence';
export type ChapterId = 'origin' | 'voyage' | 'home' | 'rules' | 'labs';

export interface Beat {
  id: string;
  chapter: ChapterId;
  range: readonly [number, number];
  camera: CameraKey[];
  narration?: string;
  narrationWindow?: readonly [number, number];
  hud?: { title: string; line: string };
  cue?: CueId;
  parallax?: number;
  /** On desktop the subject sits this many degrees right of centre (beside a text panel). Phones re-centre it. */
  subjectAngle?: number;
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * Station positions (world units).
 *
 * Origin: hero Earth + the Big Bang at (0,0,0).
 * Deep space: Voyager, then the Milky Way (the need_some_space.glb galaxy) far ahead.
 * Solar system: a separate region at SOLAR, entered from "you are here" with an
 * invisible cut (same heading, same star in the middle of the frame). We fly in
 * from beyond Neptune past every outer planet in true order, then Mars, the
 * Moon and Earth.
 *
 * Scale, one rule for everything: Earth's radius is 3 units (6,371 km) and the
 * planets and the Moon are in true proportion to it. Distances from the Sun keep
 * their true ratios at 1 AU = 600 units. Only the Sun is shrunk: at true size
 * (radius 327) it would reach halfway to Earth.
 */
const SOLAR: Vec3 = [30000, 0, 0];
const S = (x: number, y: number, z: number): Vec3 => [SOLAR[0] + x, SOLAR[1] + y, SOLAR[2] + z];
const AU = 600;
const nrm = (v: readonly number[]): Vec3 => {
  const l = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / l, v[1]! / l, v[2]! / l];
};
/** The way we arrive: straight on from the dive into "you are here" (DIVE_FROM → YAH, below). */
const IN_DIR = nrm([1301 - 1240, 231 - 194, -6753 + 6775]);
const EARTH_DIR = nrm([110, 0, -115]);
const ENTRY_R = 19500;
const EARTH: Vec3 = S(EARTH_DIR[0] * AU, 0, EARTH_DIR[2] * AU);
const At = (x: number, y: number, z: number): Vec3 => [EARTH[0] + x, EARTH[1] + y, EARTH[2] + z];
/** The inbound flight path, at distance r from the Sun: turns from the arrival heading toward Earth. */
const pathAt = (r: number): Vec3 => {
  const t = Math.min(1, Math.max(0, (ENTRY_R - r) / (ENTRY_R - AU)));
  const d = nrm([IN_DIR[0] + (EARTH_DIR[0] - IN_DIR[0]) * t, IN_DIR[1] + (EARTH_DIR[1] - IN_DIR[1]) * t, IN_DIR[2] + (EARTH_DIR[2] - IN_DIR[2]) * t]);
  return S(d[0] * r, d[1] * r, d[2] * r);
};
/** A planet just beside the path (3 of its radii to one side, a little below) so we pass it close. */
const besidePath = (au: number, R: number, side: 1 | -1): Vec3 => {
  const p = pathAt(au * AU);
  const q = pathAt(au * AU - 20);
  const t = nrm([q[0] - p[0], q[1] - p[1], q[2] - p[2]]);
  const lat = nrm([-t[2], 0, t[0]]);
  return [p[0] + lat[0] * 3 * R * side, p[1] - 0.6 * R, p[2] + lat[2] * 3 * R * side];
};
// true radii relative to Earth (3 units): Neptune 3.88, Uranus 4.0, Saturn 9.45, Jupiter 11.2, Mars 0.53, Moon 0.273
const PLANETS = {
  neptune: { au: 30.07, R: 11.6, side: 1 as const },
  uranus: { au: 19.19, R: 12, side: -1 as const },
  saturn: { au: 9.54, R: 28.4, side: 1 as const },
  jupiter: { au: 5.2, R: 33.6, side: -1 as const },
  mars: { au: 1.524, R: 1.6, side: 1 as const },
};
const planetPos = (k: keyof typeof PLANETS) => besidePath(PLANETS[k].au, PLANETS[k].R, PLANETS[k].side);

export const WORLD = {
  earthA: [0, 0, 0] as Vec3,
  earthARadius: 2,
  voyager: [0, 0, -900] as Vec3,
  /** Milky Way: centre, world radius and orientation of need_some_space.glb. */
  galaxy: [0, -200, -7000] as Vec3,
  galaxyRadius: 2400,
  // tilted ~50° to the line of sight: a three-quarter view that shows the arms
  galaxyRotation: [0.52, 0, 0.35] as Vec3,
  /** "You are here": local (0.55R, 0, 0) in the disc, rotated by galaxyRotation, plus centre. */
  youAreHere: [1240, 194, -6775] as Vec3,
  sun: SOLAR,
  sunRadius: 100,
  // inbound from the edge of the solar system, each planet just off the flight path (see PLANETS)
  neptune: planetPos('neptune'),
  neptuneRadius: PLANETS.neptune.R,
  uranus: planetPos('uranus'),
  uranusRadius: PLANETS.uranus.R,
  saturn: planetPos('saturn'),
  saturnRadius: PLANETS.saturn.R,
  jupiter: planetPos('jupiter'),
  jupiterRadius: PLANETS.jupiter.R,
  mars: planetPos('mars'),
  marsRadius: PLANETS.mars.R,
  earthB: EARTH,
  earthBRadius: 3,
  // beside the way in, nearer the camera than Earth but always smaller on screen (it is 0.27 × Earth)
  moon: At(22, 3, 40),
  satellite: At(1.44, 0.48, 2.81), // 400 km up (Earth radius 3 = 6,371 km)
  // the labs sit in a row beside Earth so the camera can pan from one to the next
  atom: At(-16, 0, 6),
  maths: At(-25, 0.5, 8.5),
  dna: At(-34, 0, 11),
} as const;

const E = EARTH;
const YAH = WORLD.youAreHere;
/** Bank angle that lines the galaxy disc up with the flight footage (tuned by eye). */
export const GALAXY_BANK = 1.0;
/** First camera frame in the solar system (the sky is aligned to it, scenes/Sky.tsx). */
/** The dive into "you are here", as a unit direction. */
// outward from the galactic centre and a little above the disc, so the core sits beyond the marker
const DIVE_FROM: Vec3 = [1301, 231, -6753];
const DIVE_DIR: Vec3 = (() => {
  const d = [YAH[0] - DIVE_FROM[0], YAH[1] - DIVE_FROM[1], YAH[2] - DIVE_FROM[2]];
  const l = Math.hypot(d[0]!, d[1]!, d[2]!);
  return [d[0]! / l, d[1]! / l, d[2]! / l] as Vec3;
})();
const along = (a: Vec3, k: number): Vec3 => [a[0] + DIVE_DIR[0] * k, a[1] + DIVE_DIR[1] * k, a[2] + DIVE_DIR[2] * k];
/**
 * First camera frame in the solar system. It looks in exactly the direction of
 * the dive, so the jump from the galaxy happens with nothing on screen but the
 * camera-locked stars and sky: you seem to keep flying, and a star ahead is the Sun.
 */
export const SOLAR_ENTRY = { pos: pathAt(ENTRY_R), look: S(0, 0, 0) } as const;
/** Fly-by keys: the planet small and ahead (60 radii out), then right beside us. */
const approachOf = (k: keyof typeof PLANETS, radii = 60) => ({ pos: pathAt(PLANETS[k].au * AU + radii * PLANETS[k].R), look: planetPos(k) });
const passOf = (k: keyof typeof PLANETS) => ({ pos: pathAt(PLANETS[k].au * AU), look: planetPos(k) });
/**
 * Milky Way → "you are here": one continuous move. The heading turns smoothly
 * while the distance shrinks exponentially, so the whole approach reads as a
 * single, steady zoom with no stops.
 */
const DIVE_START: Vec3 = [700, 640, -4900];
const DIVE_LOOK0: Vec3 = [200, -150, -6950];
const diveKeys = (): Beat['camera'] => {
  const d0 = Math.hypot(DIVE_START[0] - YAH[0], DIVE_START[1] - YAH[1], DIVE_START[2] - YAH[2]);
  const dir0 = nrm([DIVE_START[0] - YAH[0], DIVE_START[1] - YAH[1], DIVE_START[2] - YAH[2]]);
  // the view turns at a constant rate from where the Milky Way shot looks to straight at the marker
  const view0 = nrm([DIVE_LOOK0[0] - DIVE_START[0], DIVE_LOOK0[1] - DIVE_START[1], DIVE_LOOK0[2] - DIVE_START[2]]);
  const keys: Beat['camera'] = [];
  const N = 40;
  for (let i = 1; i <= N; i++) {
    const s = i / N;
    const dir = nrm([dir0[0] + (IN_DIR[0] - dir0[0]) * s, dir0[1] + (IN_DIR[1] - dir0[1]) * s, dir0[2] + (IN_DIR[2] - dir0[2]) * s]);
    // distance falls exponentially; the gentle s² term matches the speed coming out of the Milky Way shot
    const g = s / 3 + (2 * s * s) / 3;
    const d = d0 * Math.pow(24 / d0, g);
    const pos: Vec3 = [YAH[0] + dir[0] * d, YAH[1] + dir[1] * d, YAH[2] + dir[2] * d];
    const v = nrm([view0[0] + (DIVE_DIR[0] - view0[0]) * s, view0[1] + (DIVE_DIR[1] - view0[1]) * s, view0[2] + (DIVE_DIR[2] - view0[2]) * s]);
    keys.push({
      at: 0.69 * s,
      pos,
      look: [pos[0] + v[0] * d, pos[1] + v[1] * d, pos[2] + v[2] * d],
      fov: 46 - 2 * s,
      hold: i === N,
      smooth: i !== N,
    });
  }
  return keys;
};
/** Voyager framing: a slow orbit that keeps the craft in the same spot, right beside its panel. */
const VOY: Vec3 = [0, 0, -900];
const voyCam = (a: number): Vec3 => [6.3 * Math.sin(a), 1, VOY[2] + 6.3 * Math.cos(a)];
const voyLook = (a: number): Vec3 => [-0.75 * Math.cos(a), 0, VOY[2] + 0.75 * Math.sin(a)];
const off = (a: Vec3, x: number, y: number, z: number): Vec3 => [a[0] + x, a[1] + y, a[2] + z];
/** Earth on the right of frame, text on the left: shared by the sciences. */
const SIDE_CAM = At(-2.8, 1.3, 10.6);
const SIDE_LOOK = At(-3.4, 0, -0.9);
/** A station in front-left of Earth, framed right of centre. */
const stationCam = (p: Vec3): Vec3 => off(p, -1, 0.35, 6.7);
const stationLook = (p: Vec3): Vec3 => off(p, -1.85, 0, -0.45);
/** Between two labs: ease back until both are in frame, so one slides out as the next slides in. */
const between = (a: Vec3, b: Vec3, back: number): { pos: Vec3; look: Vec3 } => {
  const m: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return { pos: off(stationCam(m), 0, back * 0.15, back), look: stationLook(m) };
};

export const BEATS: Beat[] = [
  // ─────────── ORIGIN — from the ground to the beginning of everything ───────────
  {
    id: 'opening',
    chapter: 'origin',
    range: [0, 0.045],
    // close over Earth's night side, as if we just rose from the ground in the video
    camera: [
      { at: 0, pos: [1.3, 0.75, 2.75], look: [-0.6, 0.15, 0], fov: 42 },
      { at: 1, pos: [0.6, 0.7, 5.2], look: [-1.0, 0.15, 0], fov: 40 },
    ],
    parallax: 0.15,
  },
  {
    id: 'hero',
    chapter: 'origin',
    range: [0.045, 0.11],
    camera: [
      { at: 0.35, pos: [-1.6, 0.5, 9.2], look: [-2.3, 0.15, 0], fov: 38 },
      { at: 1, pos: [-1.3, 0.6, 8.6], look: [-2.0, 0.15, 0], fov: 38 },
    ],
    subjectAngle: 14,
    parallax: 0.35,
  },
  {
    id: 'void',
    chapter: 'origin',
    range: [0.11, 0.155],
    camera: [{ at: 1, pos: [-0.3, 1.4, 34], look: [0, 0, 0], fov: 40 }],
    narration: NARRATION.void,
    narrationWindow: [0.25, 1.15],
    cue: 'whoosh',
    parallax: 0.2,
  },
  {
    id: 'matter',
    chapter: 'origin',
    range: [0.155, 0.205],
    camera: [{ at: 1, pos: [0, 0.6, 15], look: [0, 0, 0], fov: 42 }],
    narration: NARRATION.matter,
    narrationWindow: [0.02, 0.85],
    cue: 'riser',
    parallax: 0.15,
  },
  {
    id: 'collision',
    chapter: 'origin',
    range: [0.205, 0.235],
    camera: [{ at: 1, pos: [0, 0.45, 12.4], look: [0, 0, 0], fov: 42, hold: true }],
    parallax: 0.02,
  },
  {
    id: 'bigbang',
    chapter: 'origin',
    range: [0.235, 0.28],
    camera: [
      { at: 0.15, pos: [0, 0.4, 11.4], look: [0, 0, 0], fov: 46 },
      { at: 1, pos: [0.2, 0.2, 2.5], look: [0, 0, -10], fov: 62 },
    ],
    cue: 'impact',
    parallax: 0.05,
  },

  // ─────────── THE VOYAGE — endless space, toward our galaxy ───────────
  {
    id: 'newborn',
    chapter: 'voyage',
    range: [0.28, 0.36],
    // drift forward through the newborn nebulae, then on toward a tiny human-made light
    camera: [
      { at: 0.45, pos: [0, 1.5, -120], look: [0, 0, -400], fov: 58 },
      { at: 1, pos: [-10, 5, -740], look: [0, 0, -900], fov: 44 },
    ],
    narration: NARRATION.newborn,
    narrationWindow: [0.2, 0.87],
    cue: 'whoosh',
    parallax: 1,
  },
  {
    id: 'voyager',
    chapter: 'voyage',
    range: [0.36, 0.42],
    // centred on Voyager, a slow half-orbit while the panel explains it
    camera: [
      // a small craft far from any star, growing as we close in
      { at: 0.08, pos: [12, 3, -860], look: VOY, fov: 40 },
      // then a slow orbit with the craft held in place beside its panel
      { at: 0.2, pos: voyCam(0.45), look: voyLook(0.45), fov: 38, hold: true },
      { at: 0.45, pos: voyCam(0.15), look: voyLook(0.15), fov: 38 },
      { at: 0.7, pos: voyCam(-0.15), look: voyLook(-0.15), fov: 38, hold: true },
      // then past it on the left, toward the galaxy
      { at: 0.86, pos: [-8, 2.5, -902], look: [0, -200, -7000], fov: 40 },
      { at: 1, pos: [-6, 4, -980], look: [0, -200, -7000], fov: 42 },
    ],
    narration: NARRATION.toVoyager,
    narrationWindow: [-0.3, 0.2],
    hud: { title: 'Voyager 1', line: 'Launched 1977 · now in interstellar space' },
    subjectAngle: 7,
    parallax: 0.2,
  },
  {
    id: 'milkyway',
    chapter: 'voyage',
    range: [0.42, 0.49],
    camera: [
      { at: 0.5, pos: [150, 500, -3100], look: [0, -200, -7000], fov: 46 },
      { at: 1, pos: [700, 640, -4900], look: [200, -150, -6950], fov: 46, smooth: true },
    ],
    narration: NARRATION.milkywayFar,
    narrationWindow: [0.15, 0.9],
    hud: { title: 'The Milky Way', line: 'About 100,000 light-years across' },
    cue: 'whoosh',
    parallax: 4,
  },
  {
    id: 'dive',
    chapter: 'voyage',
    range: [0.49, 0.57],
    camera: [
      // turning and closing in, in one smooth move (diveKeys)
      ...diveKeys(),
      // same heading, now in the solar system (invisible jump): one star ahead is ours
      { at: 0.6905, pos: SOLAR_ENTRY.pos, look: SOLAR_ENTRY.look, fov: 44, hold: true, cut: true },
      // Neptune, small and ahead beside the Sun, then growing
      { at: 0.825, ...approachOf('neptune'), fov: 42 },
      { at: 0.95, ...approachOf('neptune', 12), fov: 42 },
    ],
    narration: NARRATION.youAreHere,
    narrationWindow: [0.15, 0.42],
    hud: { title: 'You are here', line: 'About halfway out, in the Orion Arm' },
    parallax: 0.6,
  },

  // ─────────── HOME — the solar system, in the order you meet it ───────────
  {
    id: 'sun',
    chapter: 'home',
    range: [0.57, 0.572],
    camera: [],
    narration: NARRATION.sun,
    narrationWindow: [-8.5, 2],
    hud: { title: 'The Sun', line: '149.6 million km from Earth' },
    parallax: 0.6,
  },
  // each planet: small far ahead (60 of its radii), growing (15), then right beside us
  {
    id: 'neptune',
    chapter: 'home',
    range: [0.572, 0.59],
    camera: [
      { at: 0.222, ...passOf('neptune'), fov: 42 },
      { at: 0.667, ...approachOf('uranus'), fov: 42 },
    ],
    hud: { title: 'Neptune', line: 'The windiest planet: gusts over 2,000 km/h' },
    parallax: 0.6,
  },
  {
    id: 'uranus',
    chapter: 'home',
    range: [0.59, 0.61],
    camera: [
      { at: 0.1, ...approachOf('uranus', 12), fov: 42 },
      { at: 0.5, ...passOf('uranus'), fov: 42 },
      { at: 0.8, ...approachOf('saturn'), fov: 42 },
    ],
    narration: NARRATION.outer,
    narrationWindow: [-0.85, 0.1],
    hud: { title: 'Uranus', line: 'Tipped on its side, it rolls round the Sun' },
    parallax: 0.6,
  },
  {
    id: 'saturn',
    chapter: 'home',
    range: [0.61, 0.636],
    camera: [
      { at: 0.231, ...approachOf('saturn', 12), fov: 42 },
      { at: 0.615, ...passOf('saturn'), fov: 42 },
      { at: 0.846, ...approachOf('jupiter'), fov: 42 },
    ],
    hud: { title: 'Saturn', line: 'Its rings are mostly water ice' },
    cue: 'whoosh',
    parallax: 1.2,
  },
  {
    id: 'jupiter',
    chapter: 'home',
    range: [0.636, 0.66],
    camera: [
      { at: 0.25, ...approachOf('jupiter', 12), fov: 42 },
      { at: 0.667, ...passOf('jupiter'), fov: 42 },
      { at: 0.917, ...approachOf('mars'), fov: 42 },
    ],
    hud: { title: 'Jupiter', line: 'Its Great Red Spot is a storm wider than Earth' },
    parallax: 0.6,
  },
  {
    id: 'mars',
    chapter: 'home',
    range: [0.66, 0.685],
    // the slowest pass: Mars is small, so we come in close and take our time
    camera: [
      { at: 0.32, ...approachOf('mars', 12), fov: 42 },
      { at: 0.8, ...passOf('mars'), fov: 42 },
    ],
    narration: NARRATION.rocky,
    narrationWindow: [-0.3, 0.25],
    hud: { title: 'Mars', line: 'Home to Olympus Mons, the tallest volcano we know' },
    parallax: 0.3,
  },
  {
    id: 'paleBlueDot',
    chapter: 'home',
    range: [0.685, 0.7],
    // swing round to Earth's day side: a small blue world
    camera: [{ at: 0.467, pos: At(160, 20, 150), look: E, fov: 40 }],
    narration: NARRATION.paleBlueDot,
    narrationWindow: [-0.4, 1.4],
    parallax: 0.6,
  },
  {
    id: 'moon',
    chapter: 'home',
    range: [0.7, 0.75],
    camera: [
      // Earth and the Moon in one frame, Earth clearly the bigger
      { at: 0.2, pos: At(-6, 9, 72), look: At(12.5, 2.5, 26), fov: 40 },
      // then one long zoom in on Earth, straight into the first lab's framing
      { at: 1, pos: At(-2.6, 6.6, 34), look: E, fov: 42 },
    ],
    hud: { title: 'The Moon', line: '384,400 km from Earth' },
    parallax: 0.3,
  },
  {
    id: 'home',
    chapter: 'home',
    range: [0.75, 0.79],
    camera: [{ at: 0.6, pos: At(-3, 6.5, 32), look: E, fov: 42, hold: true }],
    narration: NARRATION.home,
    narrationWindow: [0.3, 1.05],
    cue: 'resolve',
    parallax: 0.3,
  },

  // ─────────── THE RULES — Earth in side view, one science at a time ───────────
  {
    id: 'physics',
    chapter: 'rules',
    range: [0.79, 0.835],
    camera: [
      // pulled back so both orbits read around Earth
      // far enough back to see the magnetic field wrapped around Earth
      { at: 0.35, pos: At(-3.5, 6.5, 32), look: At(-9.5, 0, -2), fov: 42, hold: true },
      { at: 0.8, pos: At(-4, 6.3, 31), look: At(-9.5, 0, -2), fov: 42, hold: true },
    ],
    subjectAngle: 16,
    parallax: 0.25,
  },
  {
    id: 'chemistry',
    chapter: 'rules',
    range: [0.835, 0.875],
    camera: [
      { at: 0.4, pos: stationCam(WORLD.atom), look: stationLook(WORLD.atom), fov: 38, hold: true },
      { at: 0.82, pos: off(stationCam(WORLD.atom), 0.2, 0.2, -1.0), look: stationLook(WORLD.atom), fov: 38, hold: true },
    ],
    cue: 'whoosh',
    subjectAngle: 15,
    parallax: 0.2,
  },
  {
    id: 'maths',
    chapter: 'rules',
    range: [0.875, 0.91],
    camera: [
      { at: 0.05, ...between(WORLD.atom, WORLD.maths, 6), fov: 40 },
      { at: 0.4, pos: stationCam(WORLD.maths), look: stationLook(WORLD.maths), fov: 38, hold: true },
      { at: 0.8, pos: off(stationCam(WORLD.maths), 0.1, 0.4, -0.8), look: stationLook(WORLD.maths), fov: 38, hold: true },
    ],
    subjectAngle: 15,
    parallax: 0.2,
  },
  {
    id: 'biology',
    chapter: 'rules',
    range: [0.91, 0.95],
    camera: [
      { at: 0.07, ...between(WORLD.maths, WORLD.dna, 6), fov: 40 },
      { at: 0.28, pos: stationCam(WORLD.dna), look: stationLook(WORLD.dna), fov: 38, hold: true },
      { at: 0.64, pos: off(stationCam(WORLD.dna), 0.1, 0.2, -0.6), look: stationLook(WORLD.dna), fov: 38, hold: true },
      { at: 0.78, pos: At(-17, 5, 40), look: At(-19, 0, 2), fov: 40 },
      { at: 0.9, pos: At(-3.5, 2.5, 17), look: At(-6.5, 0, -1), fov: 40, hold: true },
    ],
    cue: 'whoosh',
    subjectAngle: 17,
    parallax: 0.2,
  },

  // ─────────── LEARN MORE — the invitation ───────────
  {
    id: 'learn',
    chapter: 'labs',
    range: [0.95, 1],
    camera: [{ at: 0.6, pos: At(-3.6, 2.6, 17.5), look: At(-6.5, 0, -1), fov: 40, hold: true }],
    cue: 'whoosh',
    parallax: 0.4,
  },
];

/** Cues that fire at an exact progress point rather than a beat boundary. */
export const CUE_POINTS: { at: number; cue: CueId }[] = [{ at: 0.229, cue: 'silence' }];

export const BANG_START = 0.236;
/** The white-out holds this long (story units) before the burst of matter emerges from it. */
export const BANG_HOLD = 0.008;
export const BURST_START = BANG_START + BANG_HOLD;
export const BANG_END = 0.33;

/** Where "Skip intro" drops the visitor: arrival home, just before the rules. */
export const SKIP_TO = 0.752;

export const CHAPTERS: { id: ChapterId; label: string; at: number }[] = [
  { id: 'origin', label: 'Origin', at: 0.05 },
  { id: 'voyage', label: 'The voyage', at: 0.3 },
  { id: 'home', label: 'Home', at: 0.575 },
  { id: 'rules', label: 'The rules', at: 0.8 },
  { id: 'labs', label: 'The labs', at: 0.975 },
];

/** Scene registry: key → mount range. Implementations in scenes/ (see SceneSwitch). */
export const SCENES = {
  earthA: [0, 0.16],
  matter: [0.145, 0.245],
  bigbang: [0.225, 0.33],
  nebula: [0.26, 0.36],
  voyager: [0.33, 0.44],
  galaxy: [0.33, 0.565],
  sun: [0.5, 0.72],
  neptune: [0.54, 0.595],
  uranus: [0.57, 0.615],
  saturn: [0.585, 0.642],
  jupiter: [0.61, 0.665],
  mars: [0.635, 0.692],
  moonFlyby: [0.665, 0.76],
  satellite: [2, 2], // not on the current path
  earthB: [0.555, 1.0001],
  physics: [0.77, 0.85],
  atom: [0.815, 0.89],
  maths: [0.855, 0.925],
  dna: [0.89, 0.96],
} as const satisfies Record<string, readonly [number, number]>;

export type SceneKey = keyof typeof SCENES;

/** Length of the journey in viewport heights. */
/**
 * Pace: some stretches get more scroll per unit of story (weight 2 = twice the
 * scroll). Every timing in the project stays in story units (progress); only
 * the scroll ↔ progress mapping changes.
 */
const PACE: [number, number, number][] = [
  // the white-out of the Big Bang lingers
  [0.2354, 0.251, 1.4],
  // the nebulae and Voyager
  [0.315, 0.42, 1.35],
  // the planets on the way in
  [0.546, 0.7, 1.8],
  // the labs: time to read each one
  [0.79, 0.91, 1.9],
  // biology and why Earth is special: the longest read
  // section 04 (biology) gets the most time of all
  [0.91, 0.937, 9],
  [0.937, 0.957, 5],
];
const KNOTS = (() => {
  const ps = [0, 1, ...PACE.flatMap(([a, b]) => [a, b])].sort((x, y) => x - y);
  const weight = (p: number) => PACE.find(([a, b]) => p >= a && p < b)?.[2] ?? 1;
  const out: [number, number][] = [[0, 0]];
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1]!;
    const b = ps[i]!;
    out.push([b, out[out.length - 1]![1] + (b - a) * weight((a + b) / 2)]);
  }
  const total = out[out.length - 1]![1];
  return { pts: out.map(([p, u]) => [p, u / total] as [number, number]), total };
})();
const interp = (x: number, from: 0 | 1) => {
  const to = from === 0 ? 1 : 0;
  const pts = KNOTS.pts;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (x <= b[from]) return a[to] + ((x - a[from]) / Math.max(1e-9, b[from] - a[from])) * (b[to] - a[to]);
  }
  return 1;
};
/** Scroll fraction (0..1 of the page) → story progress. */
export const storyFromScroll = (u: number) => interp(u, 1);
/** Story progress → scroll fraction. */
export const scrollFromStory = (p: number) => interp(p, 0);
export const JOURNEY_SCREENS = Math.round(30 * KNOTS.total);

// ───────────── helpers ─────────────

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const local = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const smooth = (x: number) => x * x * (3 - 2 * x);
export const envelope = (p: number, a: number, b: number, c: number, d: number) =>
  smooth(local(p, a, b)) * (1 - smooth(local(p, c, d)));

export function beatAt(p: number): Beat {
  for (const b of BEATS) if (p >= b.range[0] && p < b.range[1]) return b;
  return BEATS[BEATS.length - 1]!;
}
export const beatById = (id: string) => BEATS.find((b) => b.id === id)!;
/** Science beats double as lab ids (for per-lab audio beds). */
export const SCIENCE_IDS = ['physics', 'chemistry', 'maths', 'biology'] as const;
export type ScienceId = (typeof SCIENCE_IDS)[number];
export const scienceOf = (b: Beat): ScienceId | null => ((SCIENCE_IDS as readonly string[]).includes(b.id) ? (b.id as ScienceId) : null);

export const at = (beat: Beat, t: number) => beat.range[0] + t * (beat.range[1] - beat.range[0]);
