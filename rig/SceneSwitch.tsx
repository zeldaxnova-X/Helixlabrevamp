'use client';

import { lazy, Suspense, useEffect, useState, type ComponentType, type LazyExoticComponent } from 'react';
import { SCENES, type SceneKey } from './beats';
import { useExperience } from '@/store/useExperience';
import { preloadModel, type ModelKey } from './models';

/**
 * Proximity mounting. Each scene module is code-split and only *exists* while
 * the scroll clock is inside its range from rig/beats.ts SCENES. Leaving the
 * range unmounts it, and its resources are freed (see rig/gpu.ts).
 *
 * Scenes are also pre-imported (JS only, no GPU work) one range ahead so a
 * mount never waits on the network mid-flight.
 */

const V = () => import('@/scenes/Voyage');
const RU = () => import('@/scenes/Rules');
const PL = () => import('@/scenes/Planets');
const importers: Record<SceneKey, () => Promise<{ default: ComponentType }>> = {
  earthA: () => import('@/scenes/Origin'),
  matter: () => import('@/scenes/MatterAntimatter'),
  bigbang: () => import('@/scenes/BigBang'),
  nebula: () => V().then((m) => ({ default: m.Nebula })),
  blackhole: () => PL().then((m) => ({ default: m.BlackHole })),
  voyager: () => V().then((m) => ({ default: m.Voyager })),
  galaxy: () => V().then((m) => ({ default: m.MilkyWay })),
  sun: () => V().then((m) => ({ default: m.Sun })),
  neptune: () => PL().then((m) => ({ default: m.Neptune })),
  uranus: () => PL().then((m) => ({ default: m.Uranus })),
  saturn: () => V().then((m) => ({ default: m.Saturn })),
  jupiter: () => PL().then((m) => ({ default: m.Jupiter })),
  mars: () => PL().then((m) => ({ default: m.Mars })),
  moonFlyby: () => V().then((m) => ({ default: m.MoonFlyby })),
  satellite: () => V().then((m) => ({ default: m.Satellite })),
  earthB: () => RU().then((m) => ({ default: m.EarthB })),
  physics: () => import('@/scenes/Life').then((m) => ({ default: m.Magnetosphere })),
  atom: () => import('@/scenes/Life').then((m) => ({ default: m.WaterDrop })),
  maths: () => RU().then((m) => ({ default: m.Sunflower })),
  dna: () => RU().then((m) => ({ default: m.Dna })),
};

const lazies = Object.fromEntries(Object.entries(importers).map(([k, imp]) => [k, lazy(imp)])) as Record<
  SceneKey,
  LazyExoticComponent<ComponentType>
>;

const PREFETCH = 0.09;
/** GLBs each scene needs — fetched + decoded one range ahead, like the JS. */
const SCENE_MODELS: Partial<Record<SceneKey, ModelKey[]>> = {
  earthA: ['earth'],
  blackhole: ['blackhole'],
  voyager: ['voyager'],
  galaxy: ['space'],
  sun: ['sun'],
  neptune: ['neptune'],
  uranus: ['uranus'],
  saturn: ['saturn'],
  jupiter: ['jupiter'],
  mars: ['mars'],
  moonFlyby: ['moon'],
  satellite: ['satellite'],
  earthB: ['earth'],
  dna: ['dna'],
};
const keys = Object.keys(SCENES) as SceneKey[];
const prefetched = new Set<SceneKey>();

function activeSet(p: number) {
  return keys.filter((k) => p >= SCENES[k][0] && p <= SCENES[k][1]).join(',');
}

export function SceneSwitch() {
  const [active, setActive] = useState(() => activeSet(useExperience.getState().progress));

  useEffect(
    () =>
      useExperience.subscribe((s) => {
        const next = activeSet(s.progress);
        setActive((cur) => (cur === next ? cur : next));
        for (const k of keys) {
          if (!prefetched.has(k) && s.progress >= SCENES[k][0] - PREFETCH && s.progress <= SCENES[k][1]) {
            prefetched.add(k);
            void importers[k]();
            SCENE_MODELS[k]?.forEach(preloadModel);
          }
        }
      }),
    [],
  );

  return (
    <>
      {active
        .split(',')
        .filter(Boolean)
        .map((k) => {
          const Scene = lazies[k as SceneKey];
          return (
            <Suspense key={k} fallback={null}>
              <Scene />
            </Suspense>
          );
        })}
    </>
  );
}
