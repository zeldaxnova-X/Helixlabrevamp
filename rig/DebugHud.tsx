'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { readExperience } from '@/store/useExperience';
import { journey } from './ScrollDriver';

/**
 * ?debug=1 — live GPU-resource counters + fps, so disposal can be verified by
 * eye: scroll the whole journey and back; geometries/textures must return to
 * their starting counts. Also exposes window.__helix for scripted audits.
 */
export function DebugHud() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const el = useRef<HTMLDivElement | null>(null);
  const frames = useRef<number[]>([]);

  useEffect(() => {
    const d = document.createElement('div');
    d.style.cssText =
      'position:fixed;left:8px;bottom:8px;z-index:9999;font:11px/1.4 ui-monospace,monospace;color:#9fe;background:rgba(0,0,0,.6);padding:6px 8px;border-radius:6px;pointer-events:none;white-space:pre';
    document.body.appendChild(d);
    el.current = d;
    (window as unknown as { __helix: unknown }).__helix = { gl, scene, camera, state: readExperience, go: (p: number) => journey.scrollToProgress(p, { immediate: true }) };
    return () => d.remove();
  }, [gl, scene, camera]);

  useFrame((_, dt) => {
    const f = frames.current;
    f.push(dt);
    if (f.length > 60) f.shift();
    if (!el.current) return;
    const avg = f.reduce((a, b) => a + b, 0) / f.length;
    const { memory, render, programs } = gl.info;
    const s = readExperience();
    el.current.textContent = `p ${s.progress.toFixed(3)}  ${s.activeBeat}\nfps ${(1 / avg).toFixed(0)}  calls ${render.calls}  tris ${render.triangles}\ngeo ${memory.geometries}  tex ${memory.textures}  prog ${programs?.length ?? 0}`;
  });

  return null;
}
