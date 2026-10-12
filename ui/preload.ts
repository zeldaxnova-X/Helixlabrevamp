'use client';

import { LEARN_MONTAGE } from '@/content/site';
import { MODELS, modelUrl, preloadModel, type ModelKey } from '@/rig/models';
import { useExperience } from '@/store/useExperience';

/**
 * Everything the journey will show on this device, fetched up front behind the
 * loader so scrolling never waits on the network. Files land in the HTTP cache
 * (assets are served with a long max-age), then the models are parsed into the
 * GLTF cache so a scene mounts without a stall.
 *
 * Progress is real: bytes received over bytes expected (sizes from HEAD).
 */

export interface Item {
  url: string;
  label: string;
}

/** In journey order, so the first scenes are ready first. */
function manifest(): Item[] {
  const { tier } = useExperience.getState();
  const tall = window.innerWidth < window.innerHeight;
  const m = (key: ModelKey, label: string): Item => ({ url: modelUrl(key), label });
  const sky = tier === 'high' ? 'hd' : tier === 'mid' ? 'hi' : 'lo';
  return [
    { url: '/assets/video/nightsky-wide.mp4', label: 'The night sky' },
    m('earth', tier === 'high' ? 'Earth · 8K day map' : 'Earth'),
    { url: `/assets/textures/milkyway-sky-${sky}.webp`, label: 'The star sky' },
    m('voyager', 'Voyager 1'),
    m('space', 'The Milky Way'),
    m('sun', 'The Sun'),
    m('neptune', 'Neptune'),
    { url: '/assets/models/neptune-rings.bin', label: 'Neptune’s rings' },
    m('uranus', 'Uranus'),
    { url: '/assets/models/uranus-rings.bin', label: 'Uranus’s rings' },
    m('saturn', 'Saturn'),
    { url: '/assets/models/saturn-rings.bin', label: 'Saturn’s rings · 520,000 particles' },
    m('jupiter', 'Jupiter'),
    { url: '/assets/models/jupiter-rings.bin', label: 'Jupiter’s rings' },
    m('mars', 'Mars'),
    m('moon', 'The Moon'),
    m('dna', 'DNA'),
    ...LEARN_MONTAGE.map((v) => ({ url: tall ? v.portrait : v.src, label: 'Footage · ' + v.caption })),
  ];
}

const MODEL_KEYS = Object.keys(MODELS).filter((k) => k !== 'satellite') as ModelKey[];

type Listener = (k: number, label: string) => void;

let started = false;
let state = { k: 0, label: 'Starting', done: false };
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l(state.k, state.label));

export function onPreload(l: Listener) {
  listeners.add(l);
  l(state.k, state.label);
  return () => void listeners.delete(l);
}

async function sizeOf(url: string): Promise<number> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return Number(r.headers.get('content-length')) || 0;
  } catch {
    return 0;
  }
}

/** Starts once; safe to call again. Resolves when everything is in. */
export function preloadAll(extra: Promise<unknown>[] = []): Promise<void> {
  if (started) return Promise.resolve();
  started = true;
  const items = manifest();
  return (async () => {
    const sizes = await Promise.all(items.map((i) => sizeOf(i.url)));
    // unknown sizes count as 1 MB so the meter still moves
    const weight = sizes.map((s) => s || 1_000_000);
    const total = weight.reduce((a, b) => a + b, 0);
    const got = new Array<number>(items.length).fill(0);
    const tick = (label: string) => {
      const k = Math.min(0.97, got.reduce((a, b) => a + b, 0) / total);
      state = { ...state, k: Math.max(state.k, k), label };
      emit();
    };
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const i = next++;
        const item = items[i]!;
        tick(item.label);
        try {
          const res = await fetch(item.url);
          const reader = res.body?.getReader();
          if (!reader) {
            await res.arrayBuffer();
          } else {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              got[i] = Math.min(weight[i]!, got[i]! + value.byteLength);
              tick(item.label);
            }
          }
        } catch {}
        // ?slowload: pace the downloads to review the loader on a fast connection
        if (location.search.includes('slowload')) await new Promise((r) => setTimeout(r, 700));
        got[i] = weight[i]!;
        tick(item.label);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), ...extra.map((p) => p.catch(() => {}))]);
    // parse every model from the cache now, not when its scene arrives (phones skip this:
    // holding every decoded texture at once is too much memory for them; scenes parse just ahead)
    if (useExperience.getState().tier !== 'low') {
      state = { ...state, label: 'Preparing the journey' };
      emit();
      MODEL_KEYS.forEach((k) => {
        try {
          preloadModel(k);
        } catch {}
      });
    }
    state = { k: 1, label: 'Ready', done: true };
    emit();
  })();
}
