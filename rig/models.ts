'use client';

import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { disposeObject } from '@/scenes/parts/dispose';
import { useExperience } from '@/store/useExperience';

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
} as const;
export type ModelKey = keyof typeof MODELS;

/** Phone-sized variants (tools/build-lo.mjs): same geometry, smaller textures. */
const LITE: Partial<Record<ModelKey, string>> = {
  earth: '/assets/models/earth-lo.glb',
  moon: '/assets/models/moon-lo.glb',
  mars: '/assets/models/mars-lo.glb',
};
/** HD variants for capable GPUs (tools/build-hd.mjs): the 8K day map. */
const HD: Partial<Record<ModelKey, string>> = {
  earth: '/assets/models/earth-hd.glb',
};
/** Variant files that failed to load on this device: fall back to the standard file. */
const failed = new Set<string>();
/** The file to load on this device: phones get lighter textures, capable GPUs the HD ones. */
export const modelUrl = (key: ModelKey): string => {
  const tier = useExperience.getState().tier;
  const variant = (tier === 'low' && LITE[key]) || (tier === 'high' && HD[key]) || undefined;
  return variant && !failed.has(variant) ? variant : MODELS[key];
};
/** Record a model URL that could not be loaded; returns true if a fallback exists for it. */
export function markModelFailed(message: string): boolean {
  const url = [...Object.values(LITE), ...Object.values(HD)].find((u) => u && message.includes(u));
  if (!url) return false;
  failed.add(url);
  useGLTF.clear(url);
  return true;
}

const refs = new Map<string, number>();
const timers = new Map<string, number>();

export function useModel(key: ModelKey) {
  const url = modelUrl(key);
  const gltf = useGLTF(url, false, true);
  const gl = useThree((s) => s.gl);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);
  // sharp at grazing angles (planet limbs, the labs seen side-on): best anisotropic filtering
  useEffect(() => {
    const max = gl.capabilities.getMaxAnisotropy();
    gltf.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m) return;
      for (const t of [m.map, m.emissiveMap, m.normalMap, m.roughnessMap, m.metalnessMap, m.alphaMap]) {
        if (t && t.anisotropy !== max) {
          t.anisotropy = max;
          t.needsUpdate = true;
        }
      }
    });
  }, [gltf, gl]);

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

export const preloadModel = (key: ModelKey) => useGLTF.preload(modelUrl(key), false, true);
