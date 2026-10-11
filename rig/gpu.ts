'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useExperience } from '@/store/useExperience';

/**
 * GPU-resource lifetime helpers. Leaked GPU memory is what crashes phones, so
 * every scene allocates through these and frees on unmount.
 *
 * R3F already disposes geometries/materials it creates from JSX. These cover
 * what it doesn't: objects built imperatively (useMemo'd ShaderMaterials,
 * BufferGeometries, CanvasTextures) and textures shared between scenes.
 */

type Disposable = { dispose: () => void };

/** useMemo that disposes the previous value when deps change and on unmount. */
export function useDisposable<T extends Disposable>(factory: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(factory, deps);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

// ───────────── ref-counted texture cache ─────────────
// Earth's maps are used by three scenes (hero, fall, physics) that are never
// mounted at the same time *except* during overlaps. Ref-counting means the
// texture survives a hand-off but is freed once the last user unmounts.

interface Entry {
  tex: THREE.Texture;
  refs: number;
  ready: Promise<THREE.Texture>;
  timer?: number;
}

const cache = new Map<string, Entry>();
const loader = typeof window !== 'undefined' ? new THREE.TextureLoader() : null;

function entry(url: string, colorSpace: THREE.ColorSpace): Entry {
  let e = cache.get(url);
  if (!e) {
    const tex = new THREE.Texture();
    const ready = new Promise<THREE.Texture>((resolve) => {
      loader!.load(
        url,
        (t) => {
          tex.image = t.image;
          tex.colorSpace = colorSpace;
          tex.anisotropy = 8;
          tex.wrapS = THREE.RepeatWrapping;
          tex.needsUpdate = true;
          resolve(tex);
        },
        undefined,
        () => resolve(tex), // a missing map renders as the placeholder colour, never blocks
      );
    });
    e = { tex, refs: 0, ready };
    cache.set(url, e);
    scheduleGc(url, e, 20000); // created but never retained (e.g. preload) → collected later
  }
  return e;
}

function scheduleGc(url: string, e: Entry, ms: number) {
  window.clearTimeout(e.timer);
  e.timer = window.setTimeout(() => {
    if (e.refs <= 0 && cache.get(url) === e) {
      e.tex.dispose();
      cache.delete(url);
    }
  }, ms);
}

/** Shared, ref-counted texture. Returns immediately (blank until loaded). */
export function useSharedTexture(url: string, colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace) {
  const e = useMemo(() => (typeof window !== 'undefined' ? entry(url, colorSpace) : null), [url, colorSpace]);
  useEffect(() => {
    if (!e) return;
    window.clearTimeout(e.timer);
    e.refs++;
    return () => {
      e.refs--;
      // Short grace period so a scene hand-off (unmount A, mount B) doesn't re-upload.
      if (e.refs <= 0) scheduleGc(url, e, 1500);
    };
  }, [e, url]);
  return e?.tex as THREE.Texture;
}

/** Warm the cache (used by the loader) without holding a reference. */
export function preloadTexture(url: string, colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace) {
  return entry(url, colorSpace).ready;
}

/** Texture tier by device. */
export function useTexTier() {
  const tier = useExperience((s) => s.tier);
  return tier === 'high' ? 'hi' : 'lo';
}

/** Soft-particle sprite generated once (no file). */
let dot: THREE.CanvasTexture | null = null;
export function dotTexture() {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  dot = new THREE.CanvasTexture(c);
  return dot;
}
