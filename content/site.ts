/**
 * Every word and link the landing page shows lives here, so the cinematic
 * experience, the mobile sequence and the flat SSR page can never disagree.
 */

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.helixlabs.pro';

export const URLS = {
  app: APP,
  signUp: process.env.NEXT_PUBLIC_SIGNUP_URL ?? `${APP}/sign-up`,
  signIn: `${APP}/sign-in`,
  dashboard: process.env.NEXT_PUBLIC_DASHBOARD_URL ?? `${APP}/`,
  site: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.helixlabs.pro',
} as const;

/** Sign-up link tagged with where on the page it was clicked (for funnel analysis). */
export function signUpHref(source: string, extra?: Record<string, string>) {
  const u = new URL(URLS.signUp);
  u.searchParams.set('from', `landing:${source}`);
  for (const [k, v] of Object.entries(extra ?? {})) u.searchParams.set(k, v);
  return u.toString();
}

/** Name of the cross-subdomain session cookie set by app.helixlabs.pro. */
export const SESSION_COOKIE = 'helix_session';

export const HERO = {
  wordmark: 'HELIX LABS',
  headline: 'A Neo Generation lab to learn everything that sustains the universe.',
  // The spec named "coding and AI" as the supplementary labs; the live hub ships
  // Aptitude and AI & ML, so the copy follows the product. Flip here if Coding Lab launches.
  subline: 'Physics, chemistry, mathematics and biology, plus AI and aptitude labs.',
  cta: 'Enter Labs',
} as const;

export type LabId = 'physics' | 'chemistry' | 'biology' | 'maths' | 'aptitude' | 'ai';

export interface Lab {
  id: LabId;
  name: string;
  /** The one line that frames the lab inside the story. */
  rule: string;
  blurb: string;
  /** What's inside — mirrors the module list in the Helix hub (Helix-hub/app/dashboard/student). */
  modules: string[];
  hook: string;
  core: boolean;
  /** Accent used by the hub orbs and lab chrome. */
  color: string;
}

export const LABS: Lab[] = [
  {
    id: 'physics',
    name: 'Physyx Lab',
    rule: 'The rules that move everything.',
    blurb: "Simulate Newton's laws, model projectile motion and feel the forces that shape the universe.",
    modules: ['Force Simulator', 'Wave Lab', 'Gravity Engine', 'Physics Quests'],
    hook: 'Same law that throws a ball keeps the Moon in orbit.',
    core: true,
    color: '#7cc4ff',
  },
  {
    id: 'chemistry',
    name: 'Chem Lab',
    rule: 'The rules that build everything.',
    blurb: 'Explore elements, chemical bonds, molecular structures and reactions through interactive 3D models.',
    modules: ['Periodic Table Explorer', 'Molecular Builder', 'Reaction Simulator', 'Bond Quiz'],
    hook: 'Every element is the same three particles, counted differently.',
    core: true,
    color: '#ffb35c',
  },
  {
    id: 'biology',
    name: 'Biology Lab',
    rule: 'The rules that make everything alive.',
    blurb: 'Explore cells, genetics, ecosystems and human anatomy through interactive 3D models.',
    modules: ['Cell Explorer', 'Genetics Simulator', 'Anatomy Viewer', 'Ecosystem Sandbox'],
    hook: 'Four letters, paired two by two, write every living thing.',
    core: true,
    color: '#7dffb2',
  },
  {
    id: 'maths',
    name: 'Math Lab',
    rule: 'The language all the other rules are written in.',
    blurb: 'Live graphs, interactive proofs and animated solutions, from geometry to integration.',
    modules: ['Graph Visualizer', 'Integration Explorer', 'Proof Builder', 'Math Games'],
    hook: 'The spiral in a sunflower is a number you can drag.',
    core: true,
    color: '#c9a7ff',
  },
  {
    id: 'ai',
    name: 'AI & ML Lab',
    rule: 'Teach a machine to learn the rules.',
    blurb: 'Learn how neural networks learn and how AI models make decisions, through hands-on experiments.',
    modules: ['Neural Network Playground', 'RAG Explorer', 'Prompt Lab', 'AI Ethics Game'],
    hook: '',
    core: false,
    color: '#ff7ac8',
  },
  {
    id: 'aptitude',
    name: 'Aptitude Lab',
    rule: 'Reason with the rules, faster.',
    blurb: 'Timed aptitude runs, quantitative word problems, speed calculation and logic riddles.',
    modules: ['Logic Puzzles', 'Speed Math', 'Pattern Trainer', 'Mock Tests'],
    hook: '',
    core: false,
    color: '#5ce1e6',
  },
];

export const labById = (id: LabId) => LABS.find((l) => l.id === id)!;

/** Narration — one short, true thought per beat. Keyed by beat id in rig/beats.ts. */
export const NARRATION = {
  void: 'Before everything, there was almost nothing.',
  matter: 'Two sparks. Matter, and its mirror.',
  universe: 'From one moment, everything.',
  warp: 'Then space began to stretch, and it never stopped.',
  newborn: 'From the first light came gas, then stars, then galaxies.',
  milkywayFar: 'Our galaxy. A spiral of hundreds of billions of suns.',
  youAreHere: 'One of them is ours.',
  neptune: 'Sunlight takes four hours to reach Neptune. From here the Sun is just the brightest star.',
  outer: 'Out here a year lasts decades. Uranus takes 84 of ours to go once round the Sun.',
  rocky: 'Past Jupiter, the small rocky worlds begin. Ours is one of them.',
  toVoyager: 'Far from any star, one thing we made is still travelling.',
  sun: 'The Sun. An ordinary star, about 4.6 billion years old.',
  paleBlueDot: 'In 1990, Voyager looked back from 6 billion km and saw us like this. A pale blue dot.',
  home: 'One planet. Every part of it runs on rules.',
} as const;

/** Why Voyager matters, shown beside the spacecraft. */
export const VOYAGER = {
  title: 'Voyager 1',
  kicker: 'Why it matters',
  facts: [
    { k: '1977', v: 'Launched to explore Jupiter and Saturn. It has never stopped travelling.' },
    { k: '2012', v: 'Became the first human-made object to reach interstellar space.' },
    { k: 'Golden Record', v: 'Carries sounds and pictures of life on Earth, for whoever finds it.' },
    { k: '24+ billion km', v: 'Still sending data home, using the same physics you learn in class.' },
  ],
} as const;

export interface Law {
  name: string;
  line: string;
  formula?: string;
}
export interface Science {
  id: 'physics' | 'chemistry' | 'maths' | 'biology';
  index: string;
  lab: string;
  title: string;
  laws: Law[];
  /** How this science keeps life on Earth going. */
  life: string;
  /** Where the camera has taken us (shown with the lab name). */
  place: string;
  /** Optional small print under the laws (e.g. how to read the model). */
  legend?: string;
  video?: { src: string; poster: string; caption: string };
}

/** The rules chapter: Earth in side view, one science at a time. */
export const SCIENCES: Science[] = [
  {
    id: 'physics',
    index: '01',
    lab: 'Physyx Lab',
    place: 'Earth and the Sun',
    title: 'The rules that move everything.',
    laws: [
      { name: 'Gravity', line: "Earth's pull holds on to our air and our oceans. A smaller planet would let them leak away into space.", formula: 'F = G · m₁m₂ / r²' },
      { name: 'Magnetism', line: "Molten iron deep in the core makes a magnetic field. It bends the solar wind around us, so it cannot strip our air away.", formula: 'B ∝ 1 / r³' },
      { name: 'Light', line: 'We sit 150 million km from the Sun. Close enough for liquid water, far enough that it does not boil.', formula: '1361 W/m²' },
    ],
    life: 'Without these three, there would be no air, no seas, and no one to breathe.',
  },
  {
    id: 'chemistry',
    index: '02',
    lab: 'Chem Lab',
    place: 'The molecule of life',
    title: 'The rules that build everything.',
    laws: [
      { name: 'Water', line: 'One oxygen, two hydrogens, bent at 104.5°. That bend gives water a slight charge, so it can dissolve the chemistry of life.', formula: 'H₂O' },
      { name: 'Photosynthesis', line: 'Plants turn sunlight, water and carbon dioxide into sugar, and release the oxygen we breathe.', formula: '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂' },
      { name: 'Ozone', line: "High in the sky, ozone absorbs most of the Sun's harmful ultraviolet light.", formula: 'O₃' },
    ],
    life: 'Every breath you take, and every cell you are made of, runs on these reactions.',
  },
  {
    id: 'maths',
    index: '03',
    lab: 'Math Lab',
    place: 'The pattern inside a sunflower',
    title: 'The language all the other rules are written in.',
    laws: [
      { name: 'The golden angle', line: 'Each new seed grows 137.5° round from the last, so no space is wasted.', formula: '360° / φ²' },
      { name: 'Fibonacci', line: 'Count the spirals and you usually find 34 one way and 55 the other. Each number is the sum of the two before it.', formula: '21 + 34 = 55' },
      { name: 'A steady orbit', line: "Earth's orbit is so close to a circle that our distance from the Sun changes by only about 3% in a year.", formula: 'e ≈ 0.017' },
    ],
    life: 'That steady orbit kept our climate calm for billions of years. Long enough for life to begin.',
  },
  {
    id: 'biology',
    index: '04',
    lab: 'Biology Lab',
    place: 'The code inside every cell',
    title: 'The rules that make everything alive.',
    laws: [
      { name: 'The code', line: 'DNA spells out instructions in four letters: A, T, G and C. A always pairs with T, and G with C.' },
      { name: 'The copy', line: 'Because the pairs always match, each strand is a template for the other. That is how life copies itself.' },
      { name: 'The scale', line: 'Each of your cells holds about 2 metres of DNA, around 3 billion letters long.' },
    ],
    life: 'Every living thing on Earth uses this same code. As far as we know, it exists nowhere else.',
    legend: 'Atoms in standard CPK colours: carbon, oxygen, nitrogen, phosphorus, hydrogen.',
  },
];

export const EARTH_FACTS = [
  'Liquid water covers about 71% of its surface',
  'A thick atmosphere and a magnetic field shield every living thing',
  'In all the space we have explored, life has been found only here',
];

/** Closing line of "why Earth is special". */
export const PRECIOUS = 'That is what makes every living thing precious.';

/** Everyday-life footage for the Learn-more finale (every supplied clip is used). */
export const LEARN_MONTAGE = [
  { src: '/assets/video/lighthouse-wide.mp4', poster: '/assets/video/lighthouse-wide.jpg', portrait: '/assets/video/lighthouse-portrait.mp4', portraitPoster: '/assets/video/lighthouse-portrait.jpg', caption: 'Light · optics' },
  { src: '/assets/video/citynight-card.mp4', poster: '/assets/video/citynight-card.jpg', portrait: '/assets/video/city-night-portrait.mp4', portraitPoster: '/assets/video/city-night-portrait.jpg', caption: 'Motion · F = m · a' },
  { src: '/assets/video/citydusk-card.mp4', poster: '/assets/video/citydusk-card.jpg', portrait: '/assets/video/city-dusk-portrait.mp4', portraitPoster: '/assets/video/city-dusk-portrait.jpg', caption: 'Life · cities · geometry' },
] as const;

export const LEARN = {
  eyebrow: 'Helix Labs',
  title: 'The universe runs on rules. So does your everyday life.',
  body: 'Why a cricket ball swings. Why bread rises. Why your phone always knows the way. Learn the rules behind all of it by playing with them, in six hands-on labs.',
  cta: 'Enter Helix Labs',
  secondary: 'Explore the labs',
} as const;

export const SCHOOLS = {
  title: 'For schools',
  blurb: 'A teacher console, class assignments and bulk rosters. Bring Helix Labs to your classroom.',
  cta: 'Talk to us',
} as const;

export const CREDITS = [
  'Earth & Moon models and textures: Sketchfab artists (licence on file).',
  'Night-sky panorama: Poly Haven (CC0).',
  'Interface sounds: Kenney (CC0) and Mixkit. Ambient bed: Pixabay audio. Footage: stock night-sky, city and lighthouse clips (licence on file).',
  'Space imagery is illustrative. Helix Labs is not affiliated with or endorsed by NASA or ESA.',
];
