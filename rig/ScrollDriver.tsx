'use client';

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { useEffect } from 'react';
import { BANG_START, BEATS, BURST_START, beatAt, JOURNEY_SCREENS, scienceOf, scrollFromStory, storyFromScroll } from './beats';
import { useExperience } from '@/store/useExperience';
import { track } from '@/analytics/track';

/**
 * Lenis → one 0..1 number in the store. Also owns:
 *  - soft "parking" for Act II labs (if you stop scrolling just short of a lab,
 *    it eases you into it; it never fights you once you're moving),
 *  - resume bookkeeping (last progress → localStorage),
 *  - beat-reached analytics.
 */

let lenis: Lenis | null = null;

export const journey = {
  /** Scrollable distance in px that maps to progress 0..1. */
  span() {
    const el = document.getElementById('journey');
    if (!el) return 1;
    return Math.max(1, el.offsetHeight - window.innerHeight);
  },
  scrollToProgress(p: number, opts: { immediate?: boolean; duration?: number } = {}) {
    const y = scrollFromStory(p) * journey.span();
    if (lenis) lenis.scrollTo(y, { immediate: opts.immediate, duration: opts.duration ?? 1.6, force: true });
    else window.scrollTo({ top: y, behavior: opts.immediate ? 'auto' : 'smooth' });
  },
  stop: () => lenis?.stop(),
  start: () => lenis?.start(),
};

const RESUME_KEY = 'helix:voyage:progress';
export function readResume(): number | null {
  try {
    const v = Number(localStorage.getItem(RESUME_KEY));
    return Number.isFinite(v) && v > 0.06 && v < 0.95 ? v : null;
  } catch {
    return null;
  }
}
export function clearResume() {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {}
}

export function ScrollDriver({ smooth = true }: { smooth?: boolean }) {
  useEffect(() => {
    const { setScroll, setActiveBeat } = useExperience.getState();
    // Always start at the beginning; returning visitors get the explicit Resume prompt instead.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    lenis = smooth ? new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.2, syncTouch: false }) : null;

    let last = -1;
    let lastT = performance.now();
    let idle: number | undefined;
    let saveAt = 0;
    const reached = new Set<string>();
    // the Big Bang white-out holds for a moment the first time you scroll into it
    let bangHeld = false;
    let bangTimer: number | undefined;

    const update = () => {
      const y = lenis ? lenis.scroll : window.scrollY;
      const p = storyFromScroll(Math.min(1, Math.max(0, y / journey.span())));
      const now = performance.now();
      const v = last < 0 ? 0 : (p - last) / Math.max(1e-3, (now - lastT) / 1000);
      if (p < BANG_START - 0.01) bangHeld = false;
      if (lenis && !bangHeld && last >= 0 && last < BANG_START + 0.001 && p >= BANG_START + 0.001 && p < BURST_START) {
        bangHeld = true;
        lenis.stop();
        bangTimer = window.setTimeout(() => lenis?.start(), 1500);
      }
      last = p;
      lastT = now;
      setScroll(p, v);

      const beat = beatAt(p);
      if (beat.id !== useExperience.getState().activeBeat) setActiveBeat(beat.id, scienceOf(beat));
      if (!reached.has(beat.id)) {
        reached.add(beat.id);
        track('beat_reached', { beat: beat.id, progress: +p.toFixed(3) });
        if (beat.id === 'enter') track('scroll_complete');
      }

      // only real progress is saved — the initial p=0 must not erase a resume point
      if (now > saveAt && p > 0.005) {
        saveAt = now + 800;
        try {
          localStorage.setItem(RESUME_KEY, p.toFixed(4));
        } catch {}
      }

      window.clearTimeout(idle);
      idle = window.setTimeout(() => park(p), 220);
    };

    // Ease into a science if the visitor stopped just short of (or just past) its park.
    const park = (p: number) => {
      for (const b of BEATS) {
        if (!scienceOf(b)) continue;
        const holds = b.camera.filter((k) => k.hold);
        if (holds.length < 2) continue;
        const span = b.range[1] - b.range[0];
        const h0 = b.range[0] + holds[0]!.at * span;
        const h1 = b.range[0] + holds[holds.length - 1]!.at * span;
        if (p > h0 - 0.1 * span && p < h0) return journey.scrollToProgress(h0 + 0.01 * span, { duration: 1.2 });
        if (p > h1 && p < h1 + 0.05 * span) return journey.scrollToProgress(h1 - 0.01 * span, { duration: 1 });
      }
    };

    // Autoplay: a steady glide (screens per second). The reading stretches already have
    // more scroll (rig/beats PACE), so they get more time. Any input hands control back.
    const AUTO_SPEED = 0.3;
    const AUTO_END = 0.975;
    let autoLast = 0;
    const auto = () => {
      const st = useExperience.getState();
      const now = performance.now();
      const dt = Math.min(0.05, (now - autoLast) / 1000);
      autoLast = now;
      if (!st.autoplay) return;
      if (st.progress >= AUTO_END) return st.setAutoplay(false);
      const dy = AUTO_SPEED * window.innerHeight * dt;
      if (lenis) {
        if (!lenis.isStopped) lenis.scrollTo(lenis.scroll + dy, { immediate: true, force: true });
      } else window.scrollBy(0, dy);
    };
    const takeBack = () => {
      if (useExperience.getState().autoplay) useExperience.getState().setAutoplay(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) takeBack();
    };
    window.addEventListener('wheel', takeBack, { passive: true });
    window.addEventListener('touchstart', takeBack, { passive: true });
    window.addEventListener('keydown', onKey);
    gsap.ticker.add(auto);

    let tick: ((time: number) => void) | null = null;
    if (lenis) {
      lenis.on('scroll', update);
      tick = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    } else {
      window.addEventListener('scroll', update, { passive: true });
    }
    // Let velocity decay to 0 when the page is still.
    const decay = window.setInterval(() => {
      const s = useExperience.getState();
      if (Math.abs(s.velocity) > 1e-4 && performance.now() - lastT > 120) s.setScroll(s.progress, s.velocity * 0.5);
    }, 100);
    update();

    return () => {
      window.clearInterval(decay);
      gsap.ticker.remove(auto);
      window.removeEventListener('wheel', takeBack);
      window.removeEventListener('touchstart', takeBack);
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(bangTimer);
      window.clearTimeout(idle);
      if (tick) gsap.ticker.remove(tick);
      window.removeEventListener('scroll', update);
      lenis?.destroy();
      lenis = null;
    };
  }, [smooth]);

  return null;
}

/** The tall element whose scroll length *is* the timeline. */
export function JourneySpacer() {
  return <div id="journey" aria-hidden style={{ height: `${JOURNEY_SCREENS * 100}svh` }} />;
}
