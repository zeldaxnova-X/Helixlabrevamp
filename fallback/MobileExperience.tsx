'use client';

import { useEffect, useRef, useState } from 'react';
import { EARTH_FACTS, HERO, LABS, LEARN, NARRATION, SCIENCES, signUpHref } from '@/content/site';
import { TopBar } from '@/ui/TopBar';
import { audio } from '@/audio/engine';
import { track } from '@/analytics/track';
import { useExperience } from '@/store/useExperience';

/**
 * The mobile experience — its own thing, not the desktop scene degraded.
 * The same story as a short run of full-screen scenes: a CSS-rendered Earth,
 * a 2D-canvas Big Bang, portrait video for the sky and the planet, then the
 * same four mini-labs and the six-lab hub. No three.js is downloaded.
 *
 * `calm` (prefers-reduced-motion): every beat becomes near-static — no video
 * autoplay, no burst, no spin; fades only.
 */
export default function MobileExperience({ calm }: { calm: boolean }) {
  const reached = useRef(new Set<string>());

  // beat analytics, same names as the cinematic beats
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.beat!;
          if (e.isIntersecting && !reached.current.has(id)) {
            reached.current.add(id);
            track('beat_reached', { beat: id, mode: calm ? 'calm' : 'mobile' });
          }
        }
      },
      { threshold: 0.5 },
    );
    document.querySelectorAll('[data-beat]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [calm]);

  const skip = () => {
    track('skip_intro', { mode: calm ? 'calm' : 'mobile' });
    document.getElementById('m-hub')?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth' });
  };

  // Autoplay (the TopBar button): a steady glide down the page until the hub, or until you touch it.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const stop = () => {
      if (useExperience.getState().autoplay) useExperience.getState().setAutoplay(false);
    };
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const st = useExperience.getState();
      if (st.autoplay) {
        const hub = document.getElementById('m-hub');
        const atEnd = (hub && hub.getBoundingClientRect().top <= window.innerHeight * 0.05) || window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 2;
        if (atEnd) st.setAutoplay(false);
        else window.scrollTo({ top: window.scrollY + 0.22 * window.innerHeight * dt, behavior: 'instant' });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('wheel', stop, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('wheel', stop);
      stop();
    };
  }, []);

  useEffect(() => {
    audio.preloadActOne();
    const t = window.setTimeout(() => void audio.preloadActTwo(), 5000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className={`m ${calm ? 'm--calm' : ''}`}>
      <a href="#flat" className="skiplink">
        Skip to the simple page
      </a>
      <TopBar onSkip={skip} showSkip showAutoplay />

      <section className="m-scene m-hero m-video" data-beat="hero">
        <LazyVideo name="milkyway" calm={calm} eager />
        <div className="m-hero__copy">
          <p className="hud-label">A journey through the rules of the universe</p>
          <h2 className="display display--xl">{HERO.wordmark}</h2>
          <p className="m-hero__headline">{HERO.headline}</p>
          <a className="btn btn--primary btn--lg" href={signUpHref('m-hero')} onClick={() => track('signup_click', { source: 'm-hero' })}>
            {HERO.cta}
          </a>
        </div>
        <p className="scrollcue">
          <span>Scroll</span>
          <i />
        </p>
      </section>

      <section className="m-scene m-void" data-beat="void">
        <CssEarth calm={calm} />
        <span className="m-void__star" />
        <p className="narration narration--static">{NARRATION.void}</p>
      </section>

      <section className="m-scene m-bang" data-beat="bigbang">
        <MobileBang calm={calm} />
      </section>

      <section className="m-scene m-void" data-beat="warp">
        <p className="narration narration--static">{NARRATION.warp}</p>
      </section>

      <section className="m-scene m-video" data-beat="milkyway-far">
        <video className="m-video__el" src="/assets/video/milkyway-flight.mp4" poster="/assets/video/milkyway-flight.jpg" muted playsInline loop autoPlay={!calm} preload="none" aria-hidden />
        <p className="narration narration--static">{NARRATION.milkywayFar}</p>
      </section>

      <section className="m-scene m-video" data-beat="home">
        <LazyVideo name="city-night" calm={calm} />
        <p className="narration narration--static">{NARRATION.home}</p>
      </section>

      {SCIENCES.map((sc) => (
        <section key={sc.id} className="m-science" data-beat={sc.id}>
          <p className="hud-label">
            <span className="science__index">{sc.index}</span> {sc.lab}
          </p>
          <h2 className="display display--m">{sc.title}</h2>
          <ul className="science__laws">
            {sc.laws.map((l) => (
              <li key={l.name} style={{ opacity: 1 }}>
                <span className="science__law">{l.name}</span>
                <span className="science__line">{l.line}</span>
                {l.formula && <span className="science__formula">{l.formula}</span>}
              </li>
            ))}
          </ul>
          {sc.id === 'biology' && (
            <ul className="facts">
              {EARTH_FACTS.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="m-learn m-video" id="m-hub" data-beat="learn">
        <LazyVideo name="lighthouse" calm={calm} />
        <div className="m-hero__copy">
          <p className="hud-label">{LEARN.eyebrow}</p>
          <h2 className="display display--m">{LEARN.title}</h2>
          <p className="m-hero__headline">{LEARN.body}</p>
          <a className="btn btn--primary btn--xl" href={signUpHref('m-final')} onClick={() => track('signup_click', { source: 'm-final' })} data-beat="enter">
            {LEARN.cta}
          </a>
          <ul className="learn__labs">
            {LABS.map((l) => (
              <li key={l.id} style={{ ['--c' as string]: l.color }}>
                {l.name}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

/** Earth in pure CSS: the extracted day map scrolling behind a lit-sphere mask. */
function CssEarth({ calm }: { calm: boolean }) {
  return (
    <div className={`css-earth ${calm ? 'is-still' : ''}`} aria-hidden>
      <div className="css-earth__map" />
      <div className="css-earth__night" />
      <div className="css-earth__shade" />
      <div className="css-earth__atmo" />
    </div>
  );
}

function LazyVideo({ name, calm, eager }: { name: string; calm: boolean; eager?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || calm) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          if (!v.src) v.src = `/assets/video/${name}-portrait.mp4`;
          void v.play().catch(() => {});
        } else v.pause();
      },
      { rootMargin: '60% 0px' },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [name, calm]);
  return <video ref={ref} className="m-video__el" poster={`/assets/video/${name}-portrait.jpg`} muted playsInline loop preload={eager ? 'auto' : 'none'} aria-hidden />;
}

/**
 * Matter & antimatter → stillness → the bang, drawn in 2D. Plays when the
 * scene is on screen; tap to replay. ~1600 particles — cheap on any phone.
 */
function MobileBang({ calm }: { calm: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [line, setLine] = useState<string>(NARRATION.matter);
  const run = useRef<() => void>(() => {});

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener('resize', resize);

    type P = { a: number; s: number; r: number; seed: number };
    const parts: P[] = Array.from({ length: 1600 }, () => ({ a: Math.random() * Math.PI * 2, s: 0.35 + Math.pow(Math.random(), 0.5) * 0.75, r: 0, seed: Math.random() }));
    let t0 = 0;
    let raf = 0;
    let playing = false;
    let impactFired = false;

    const heat = (k: number, seed: number) => {
      if (k > 0.75) return `rgba(255,248,235,`;
      if (k > 0.5) return `rgba(255,190,90,`;
      if (k > 0.3) return `rgba(240,90,40,`;
      return seed > 0.6 ? `rgba(160,110,255,` : `rgba(110,140,255,`;
    };

    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const cx = w / 2, cy = h * 0.44;
      ctx.fillStyle = 'rgba(2,3,9,0.35)';
      ctx.fillRect(0, 0, w, h);
      const SPIRAL = 2.6, HOLD = 0.8;
      if (t < SPIRAL + HOLD) {
        // two bodies spiralling in, then frozen just short of contact
        const k = Math.min(1, t / SPIRAL);
        const r = (1 - k * 0.96) * Math.min(w, h) * 0.3;
        const ang = (k < 1 ? k * k * 14 : 14) + 0.3;
        for (const [side, col] of [
          [0, '255,190,100'],
          [1, '130,180,255'],
        ] as const) {
          const a = ang + side * Math.PI;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.45;
          const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
          g.addColorStop(0, `rgba(${col},1)`);
          g.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, 22, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const bt = t - SPIRAL - HOLD;
        if (!impactFired) {
          impactFired = true;
          audio.cue('impact');
          setLine(NARRATION.universe);
        }
        // flash + ring
        if (bt < 0.5) {
          ctx.fillStyle = `rgba(255,246,230,${Math.max(0, 1 - bt * 2.2)})`;
          ctx.fillRect(0, 0, w, h);
        }
        const ring = bt * Math.max(w, h) * 0.9;
        ctx.strokeStyle = `rgba(255,214,160,${Math.max(0, 0.6 - bt * 0.5)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, ring, 0, Math.PI * 2);
        ctx.stroke();
        const E = 1 - Math.exp(-bt * 2.2);
        const k = Math.max(0, 1 - bt * 0.45);
        for (const p of parts) {
          const d = p.s * E * Math.max(w, h) * 0.75;
          const wob = Math.sin(p.a * 7 + p.seed * 10) * 0.12 * E;
          const x = cx + Math.cos(p.a + wob) * d, y = cy + Math.sin(p.a + wob) * d;
          const kk = Math.min(1, k + (p.s - 0.8) * 0.3);
          ctx.fillStyle = heat(kk, p.seed) + (0.5 + 0.5 * kk) + ')';
          const sz = 1 + kk * 2.2;
          ctx.fillRect(x, y, sz, sz);
        }
        if (bt > 7) {
          playing = false;
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      ctx.fillStyle = '#020309';
      ctx.fillRect(0, 0, w, h);
      if (calm) {
        const g = ctx.createRadialGradient(w / 2, h * 0.44, 0, w / 2, h * 0.44, Math.min(w, h) * 0.45);
        g.addColorStop(0, 'rgba(255,214,160,0.55)');
        g.addColorStop(1, 'rgba(255,214,160,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        setLine(NARRATION.universe);
        return;
      }
      playing = true;
      impactFired = false;
      setLine(NARRATION.matter);
      t0 = performance.now();
      audio.cue('riser');
      raf = requestAnimationFrame(frame);
    };
    run.current = start;

    const io = new IntersectionObserver(([e]) => e?.isIntersecting && !playing && start(), { threshold: 0.6 });
    io.observe(c);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
    };
  }, [calm]);

  return (
    <>
      <canvas ref={canvas} className="m-bang__canvas" aria-hidden onClick={() => run.current()} />
      <p className="narration narration--static" aria-live="polite">
        {line}
      </p>
      {!calm && (
        <button type="button" className="m-bang__replay" onClick={() => run.current()}>
          Replay the bang
        </button>
      )}
    </>
  );
}
