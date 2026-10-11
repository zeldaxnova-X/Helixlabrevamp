'use client';

import { useEffect, useRef, useState } from 'react';
import { HERO } from '@/content/site';
import { useExperience } from '@/store/useExperience';

/**
 * "HELIX LABS" over black with a meter that fills as Act I streams in.
 * Hard cap: whatever has arrived after 8 s, we go — scenes render their
 * placeholders until the rest lands. A single faint star drifts in on completion.
 */
const HARD_CAP_MS = 8000;

export function Loader() {
  const [k, setK] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'star' | 'gone'>('loading');
  const setLoaded = useExperience((s) => s.setLoaded);
  const t0 = useRef(performance.now());

  useEffect(() => {
    const on = (e: Event) => setK((x) => Math.max(x, (e as CustomEvent<number>).detail));
    setK((x) => Math.max(x, (window as unknown as { __helixLoad?: number }).__helixLoad ?? 0));
    window.addEventListener('helix:load', on);
    const cap = window.setTimeout(() => setK(1), HARD_CAP_MS);
    return () => {
      window.removeEventListener('helix:load', on);
      window.clearTimeout(cap);
    };
  }, []);

  const finishing = useRef(false);
  useEffect(() => {
    if (k < 1 || finishing.current) return;
    finishing.current = true;
    // Never flash: hold the wordmark at least ~900 ms. These timers must not be
    // tied to `phase` (changing it would cancel them), so they run once, unguarded.
    const wait = Math.max(0, 900 - (performance.now() - t0.current));
    window.setTimeout(() => setPhase('star'), wait);
    window.setTimeout(() => {
      setPhase('gone');
      setLoaded();
    }, wait + 1100);
  }, [k, setLoaded]);

  if (phase === 'gone') return null;
  return (
    <div className={`loader loader--${phase}`} role="status" aria-live="polite">
      <div className="loader__mark">{HERO.wordmark}</div>
      <div className="loader__meter" aria-hidden>
        <i style={{ transform: `scaleX(${k})` }} />
      </div>
      <span className="sr-only">{k < 1 ? `Loading ${Math.round(k * 100)} percent` : 'Ready'}</span>
      <span className="loader__star" aria-hidden />
    </div>
  );
}
