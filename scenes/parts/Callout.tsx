'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { readExperience } from '@/store/useExperience';

/**
 * A sci-fi readout pinned to a point on a subject: a thin leader line drawn out
 * from the point to a small panel with a name and a few stats. It draws itself
 * in when it appears (CSS, `.is-on`), reads leftwards near the right edge of the
 * screen, and never shows when the point is behind the camera.
 */
export function Callout({
  at,
  title,
  line,
  stats,
  visible,
}: {
  at: readonly [number, number, number];
  title: string;
  line?: string;
  stats?: readonly (readonly [string, string])[];
  /** 0..1 opacity from the scroll clock and the camera's distance to the point. */
  visible: (p: number, d: number) => number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const pos = useMemo(() => new THREE.Vector3(...at), [at]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const node = el.current;
    if (!node) return;
    const d = camera.position.distanceTo(pos);
    camera.getWorldDirection(fwd);
    const ahead = tmp.copy(pos).sub(camera.position).normalize().dot(fwd);
    const o = ahead > 0.2 ? Math.max(0, Math.min(1, visible(readExperience().progress, d))) : 0;
    const ndc = tmp.copy(pos).project(camera);
    // reach toward the roomier side of the screen (on narrow phones, whichever half has more space)
    const narrow = window.innerWidth < window.innerHeight;
    node.classList.toggle('readout--left', ndc.x > (narrow ? 0 : 0.2));
    // draw in once it is clearly there; reset when it has gone, so it draws again next time
    if (o > 0.6) node.classList.add('is-on');
    else if (o < 0.05) node.classList.remove('is-on');
    node.style.opacity = o.toFixed(3);
    node.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    // keep the panel on screen: slide it back in if it would cross an edge
    const box = node.querySelector<HTMLElement>('.readout__box');
    if (box && o > 0.01) {
      const prev = parseFloat(box.style.translate || '0');
      const r = box.getBoundingClientRect();
      const left = r.left - prev;
      const right = r.right - prev;
      const W = window.innerWidth;
      const shift = left < 10 ? 10 - left : right > W - 10 ? W - 10 - right : 0;
      if (Math.abs(shift - prev) > 0.5) box.style.translate = shift.toFixed(1) + 'px 0';
    }
  });
  return (
    <Html position={at as unknown as [number, number, number]} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
      <div ref={el} className="readout" style={{ opacity: 0, visibility: 'hidden' }}>
        <span className="readout__dot" aria-hidden />
        <svg className="readout__line" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
          <path d="M0 40 L28 2 L100 2" pathLength={1} />
        </svg>
        <div className="readout__box">
          <b className="readout__title">{title}</b>
          {line && <span className="readout__sub">{line}</span>}
          {stats && (
            <dl className="readout__stats">
              {stats.map(([k, v], i) => (
                <div key={k} style={{ transitionDelay: `${0.35 + i * 0.08}s` }}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </Html>
  );
}

/** Fade in as the camera closes from `far` to `near` (world units). */
export const byDistance = (far: number, near: number) => (_p: number, d: number) => (far - d) / Math.max(1e-6, far - near);
