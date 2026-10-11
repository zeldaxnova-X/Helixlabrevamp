'use client';

import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { disposeObject } from '@/scenes/parts/dispose';

/**
 * Ref-counted GLB models.
 *
 * Earth, the Moon and the satellite each appear in more than one scene (hero
 * Earth and arrival Earth, the Moon flyby and the Moon in orbit). Every user
 * gets its own *clone* of the scene graph (cheap — geometry and textures are
 * shared), and the shared GPU resources are freed only when the last user
 * unmounts. All models are meshopt-compressed (tools/build-assets.mjs).
 */

export const MODELS = {
  earth: '/assets/models/earth.glb',
  moon: '/assets/models/moon.glb',
  sun: '/assets/models/sun.glb',
  saturn: '/assets/models/saturn.glb',
  satellite: '/assets/models/satellite.glb',
  voyager: '/assets/models/voyager.glb',
  space: '/assets/models/space.glb',
  dna: '/assets/models/dna.glb',
  jupiter: '/assets/models/jupiter.glb',
  uranus: '/assets/models/uranus.glb',
  neptune: '/assets/models/neptune.glb',
  mars: '/assets/models/mars.glb',
  blackhole: '/assets/models/blackhole.glb',
} as const;
export type ModelKey = keyof typeof MODELS;

const refs = new Map<string, number>();
const timers = new Map<string, number>();

export function useModel(key: ModelKey) {
  const url = MODELS[key];
  const gltf = useGLTF(url, false, true);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);

  useEffect(() => {
    window.clearTimeout(timers.get(url));
    refs.set(url, (refs.get(url) ?? 0) + 1);
    return () => {
      const n = (refs.get(url) ?? 1) - 1;
      refs.set(url, n);
      if (n <= 0) {
        // grace period so a hand-off between scenes doesn't re-decode
        timers.set(
          url,
          window.setTimeout(() => {
            if ((refs.get(url) ?? 0) > 0) return;
            disposeObject(gltf.scene);
            useGLTF.clear(url);
          }, 2500),
        );
      }
    };
  }, [url, gltf]);

  return { scene, animations: gltf.animations };
}

export const preloadModel = (key: ModelKey) => useGLTF.preload(MODELS[key], false, true);
