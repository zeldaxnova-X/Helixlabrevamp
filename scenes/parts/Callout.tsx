'use client';

import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { readExperience } from '@/store/useExperience';

/**
 * A sci-fi readout for a planet. The card is docked in one place on screen, the same
 * for every planet (left, under the caption on phones), and a thin leader line runs
 * from the card's nearest edge to the planet's limb, so it never crosses the text and
 * keeps the same look whatever the planet's size. The card draws itself in (CSS,
 * `.is-on`), its numbers count up, and an Earth for scale shows how big the planet is.
 */
export interface Readout {
  title: string;
  line?: string;
  stats?: readonly (readonly [string, string])[];
  /** Order from the Sun. */
  n?: number;
  /** Diameter in Earths. */
  earths?: number;
  /** The planet's colour, for the scale graphic. */
  accent?: string;
}

export function Callout({
  around,
  visible,
  ...info
}: Readout & {
  /** The planet: the line ends on its limb. */
  around: { center: readonly [number, number, number]; radius: number };
  /** 0..1 opacity from the scroll clock and the camera's distance to the planet. */
  visible: (p: number, d: number) => number;
}) {
  const size = useThree((s) => s.size);
  const el = useRef<HTMLDivElement>(null);
  const ctr = useMemo(() => new THREE.Vector3(...around.center), [around]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const count = useRef<{ t0: number; done: boolean }>({ t0: 0, done: true });

  useFrame(({ camera, clock }) => {
    const node = el.current;
    if (!node) return;
    const d = camera.position.distanceTo(ctr);
    camera.getWorldDirection(fwd);
    const ahead = tmp.copy(ctr).sub(camera.position).normalize().dot(fwd);
    const o = ahead > 0.2 ? Math.max(0, Math.min(1, visible(readExperience().progress, d))) : 0;
    node.style.opacity = o.toFixed(3);
    node.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    if (o < 0.01) {
      if (node.classList.contains('is-on')) node.classList.remove('is-on');
      return;
    }
    // draw in once it is clearly there; reset when it has gone, so it draws again next time
    if (o > 0.6 && !node.classList.contains('is-on')) {
      node.classList.add('is-on');
      count.current = { t0: clock.elapsedTime + 0.35, done: false };
    }

    // the planet on screen: centre and radius in pixels
    const W = size.width;
    const H = size.height;
    const c = tmp.copy(ctr).project(camera);
    const cx = (c.x * 0.5 + 0.5) * W;
    const cy = (-c.y * 0.5 + 0.5) * H;
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    const e = tmp.copy(ctr).addScaledVector(right, around.radius).project(camera);
    const rs = Math.abs((e.x * 0.5 + 0.5) * W - cx);

    // from the card's nearest point to the planet's limb, along the line between them
    const card = node.querySelector<HTMLElement>('.readout__box');
    const path = node.querySelector<SVGPathElement>('.readout__line path');
    const dot = node.querySelector<HTMLElement>('.readout__dot');
    if (card && path && dot) {
      const r = card.getBoundingClientRect();
      const hx = Math.min(Math.max(cx, r.left), r.right);
      const hy = Math.min(Math.max(cy, r.top + 18), r.bottom);
      const dx = hx - cx;
      const dy = hy - cy;
      const len = Math.hypot(dx, dy);
      const reach = len > rs + 6;
      const ax = cx + (dx / Math.max(1e-3, len)) * (rs + 4);
      const ay = cy + (dy / Math.max(1e-3, len)) * (rs + 4);
      path.setAttribute('d', reach ? `M${hx.toFixed(1)} ${hy.toFixed(1)} L${ax.toFixed(1)} ${ay.toFixed(1)}` : '');
      dot.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px)`;
      dot.style.display = len > rs ? '' : 'none';
    }

    // numbers count up as the card draws in
    if (!count.current.done) {
      const k = Math.min(1, Math.max(0, (clock.elapsedTime - count.current.t0) / 1.1));
      const ease = 1 - Math.pow(1 - k, 3);
      node.querySelectorAll<HTMLElement>('dd[data-v]').forEach((dd) => {
        dd.textContent = countTo(dd.dataset.v!, ease);
      });
      if (k >= 1) count.current.done = true;
    }
  });

  const { title, line, stats, n, earths, accent } = info;
  return (
    <Html fullscreen calculatePosition={() => [size.width / 2, size.height / 2]} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
      <div ref={el} className="readout" style={{ opacity: 0, visibility: 'hidden', ['--accent' as string]: accent ?? '#9cc8ff' }}>
        <svg className="readout__line" width={size.width} height={size.height} aria-hidden>
          <path d="" pathLength={1} />
        </svg>
        <span className="readout__dot" aria-hidden />
        <div className="readout__box">
          <i className="readout__corner readout__corner--tl" aria-hidden />
          <i className="readout__corner readout__corner--br" aria-hidden />
          <div className="readout__head">
            {n !== undefined && <span className="readout__n">{String(n).padStart(2, '0')}</span>}
            <span>
              <b className="readout__title">{title}</b>
              {line && <span className="readout__sub">{line}</span>}
            </span>
          </div>
          {earths !== undefined && <Scale earths={earths} />}
          {stats && (
            <dl className="readout__stats">
              {stats.map(([k, v], i) => (
                <div key={k} style={{ transitionDelay: `${0.35 + i * 0.08}s` }}>
                  <dt>{k}</dt>
                  <dd data-v={v}>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </Html>
  );
}

/** The planet as a disc with Earth beside it at the same scale. */
function Scale({ earths }: { earths: number }) {
  const big = earths >= 1;
  // the larger of the two fills the graphic's height
  const R = 15;
  const pr = big ? R : R * earths;
  const er = big ? R / earths : R;
  const w = Math.ceil(2 + 2 * pr + 5 + 2 * Math.max(1.2, er) + 2);
  const across = Math.round(earths);
  const label = big ? `${across} Earths across` : earths > 0.45 && earths < 0.6 ? 'About half as wide as Earth' : `${earths.toFixed(1)} of Earth’s width`;
  return (
    <div className="readout__scale">
      <svg width={w} height="34" viewBox={`0 0 ${w} 34`} aria-hidden>
        <circle cx={2 + pr} cy="17" r={pr} className="readout__scale-planet" />
        <circle cx={2 + 2 * pr + 5 + Math.max(1.2, er)} cy="17" r={Math.max(1.2, er)} className="readout__scale-earth" />
      </svg>
      <span>
        {label}
        <small>Earth for scale</small>
      </span>
    </div>
  );
}

/** '139,820 km' at 0.5 → '69,910 km': the first number in a value, eased up from zero. */
function countTo(v: string, k: number) {
  const m = v.match(/[\d,]*\.?\d+/);
  if (!m) return v;
  const raw = m[0];
  const num = parseFloat(raw.replace(/,/g, ''));
  const dec = raw.includes('.') ? raw.split('.')[1]!.length : 0;
  const now = num * k;
  const txt = raw.includes(',') ? Math.round(now).toLocaleString('en-US') : now.toFixed(dec);
  return v.replace(raw, txt);
}

/** Fade in as the camera closes from `far` to `near` (world units). */
export const byDistance = (far: number, near: number) => (_p: number, d: number) => (far - d) / Math.max(1e-6, far - near);
