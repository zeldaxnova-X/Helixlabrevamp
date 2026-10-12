'use client';

import { useEffect, useRef, useState } from 'react';
import { HERO } from '@/content/site';
import { useExperience } from '@/store/useExperience';
import { onPreload } from './preload';

/**
 * The way in. The wordmark arrives letter by letter, a real percentage counts
 * up as the journey downloads (ui/preload.ts) and a status line names what is
 * coming in. When everything is in, the screen splits horizontally and opens
 * onto the scene. On a slow connection, "Start now" appears after a few seconds
 * and the rest keeps streaming behind the journey.
 */
const MIN_MS = 1400; // never flash
const OFFER_START_MS = 7000;
const HARD_CAP_MS = 60000;

export function Loader() {
  const [k, setK] = useState(0);
  const [label, setLabel] = useState('Starting');
  const [phase, setPhase] = useState<'loading' | 'open' | 'gone'>('loading');
  const [offer, setOffer] = useState(false);
  const setLoaded = useExperience((s) => s.setLoaded);
  const t0 = useRef(performance.now());
  const opening = useRef(false);

  const open = () => {
    if (opening.current) return;
    opening.current = true;
    const wait = Math.max(0, MIN_MS - (performance.now() - t0.current));
    window.setTimeout(() => {
      setPhase('open');
      setLoaded();
      window.setTimeout(() => setPhase('gone'), 1300);
    }, wait);
  };

  useEffect(() => {
    const off = onPreload((v, l) => {
      setK(v);
      setLabel(l);
      if (v >= 1) open();
    });
    const a = window.setTimeout(() => setOffer(true), OFFER_START_MS);
    const b = window.setTimeout(open, HARD_CAP_MS);
    return () => {
      off();
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'gone') return null;
  const pct = Math.round(k * 100);
  return (
    <div className={`loader loader--${phase}`} role="status" aria-live="polite">
      <div className="loader__half loader__half--top" />
      <div className="loader__half loader__half--bottom" />
      <div className="loader__body">
        <div className="loader__mark" aria-label={HERO.wordmark}>
          {[...HERO.wordmark].map((c, i) => (
            <span key={i} style={{ animationDelay: `${0.08 + i * 0.06}s` }} aria-hidden>
              {c === ' ' ? ' ' : c}
            </span>
          ))}
        </div>
        <div className="loader__count" aria-hidden>
          {String(pct).padStart(3, '0')}
          <small>%</small>
        </div>
        <div className="loader__meter" aria-hidden>
          <i style={{ transform: `scaleX(${k})` }} />
        </div>
        <p className="loader__label" key={label}>
          {label}
        </p>
        <span className="sr-only">{k < 1 ? `Loading ${pct} percent` : 'Ready'}</span>
        <button type="button" className={`loader__start ${offer && k < 1 ? 'is-on' : ''}`} onClick={open} tabIndex={offer ? 0 : -1}>
          Start now · the rest streams in
        </button>
      </div>
      <p className="loader__phones" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="14" width="4" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="17" y="14" width="4" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        Best with headphones
      </p>
    </div>
  );
}
