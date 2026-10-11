'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { readExperience } from '@/store/useExperience';

/**
 * A label pinned to a point in the scene: a small "+" marker, a name and one
 * line. It shows only while `visible(progress, distance)` says so, and never
 * when the point is behind the camera.
 */
export function Callout({
  at,
  title,
  line,
  visible,
  side = 'right',
  portraitAt,
}: {
  at: readonly [number, number, number];
  /** Phones: where the ring sits (on the subject itself, edolus-style). Defaults to `at`. */
  portraitAt?: readonly [number, number, number];
  title: string;
  line?: string;
  /** 0..1 opacity from the scroll clock and the camera's distance to the point. */
  visible: (p: number, d: number) => number;
  side?: 'right' | 'left';
}) {
  const el = useRef<HTMLDivElement>(null);
  const [tall] = useState(() => typeof window !== 'undefined' && window.innerWidth < window.innerHeight);
  const anchor = tall && portraitAt ? portraitAt : at;
  const pos = useMemo(() => new THREE.Vector3(...anchor), [anchor]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const node = el.current;
    if (!node) return;
    const d = camera.position.distanceTo(pos);
    camera.getWorldDirection(fwd);
    const ahead = tmp.copy(pos).sub(camera.position).normalize().dot(fwd);
    const o = ahead > 0.2 ? Math.max(0, Math.min(1, visible(readExperience().progress, d))) : 0;
    // near the right edge (narrow phone screens especially) the label reads leftwards instead
    const ndc = tmp.copy(pos).project(camera);
    node.classList.toggle('callout--left', side === 'left' || ndc.x > 0.3);
    node.style.opacity = o.toFixed(3);
    node.style.visibility = o < 0.01 ? 'hidden' : 'visible';
  });
  return (
    <Html position={anchor as unknown as [number, number, number]} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
      <div ref={el} className="callout" style={{ opacity: 0, visibility: 'hidden' }}>
        <span className="callout__mark" aria-hidden>
          +
        </span>
        <span className="callout__text">
          <b>{title}</b>
          {line && <span>{line}</span>}
        </span>
      </div>
    </Html>
  );
}

/** Fade in as the camera closes from `far` to `near` (world units). */
export const byDistance = (far: number, near: number) => (_p: number, d: number) => (far - d) / Math.max(1e-6, far - near);
