'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BEATS, CHAPTERS, SKIP_TO, beatById, envelope, local, smooth, type Beat, scrollFromStory } from '@/rig/beats';
import { journey, readResume, clearResume } from '@/rig/ScrollDriver';
import { useProgressStyle } from './useProgressStyle';
import { TopBar } from './TopBar';
import { EARTH_FACTS, HERO, LABS, LEARN, LEARN_MONTAGE, PRECIOUS, SCIENCES, VOYAGER, signUpHref, type Science } from '@/content/site';
import { useExperience } from '@/store/useExperience';
import { track } from '@/analytics/track';
import { audio } from '@/audio/engine';
import { requestTilt } from '@/rig/tilt';

/** Everything 2D that sits over (or under) the canvas in the cinematic mode. */
export function CinematicOverlay() {
  const loaded = useExperience((s) => s.loaded);
  const [skipVisible, setSkipVisible] = useState(false);
  const beforeSkip = useExperience((s) => s.progress < SKIP_TO - 0.01);
  const blackout = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loaded) return;
    const t = window.setTimeout(() => setSkipVisible(true), 3500);
    return () => window.clearTimeout(t);
  }, [loaded]);

  const skip = useCallback(() => {
    track('skip_intro', { from: +useExperience.getState().progress.toFixed(3) });
    const el = blackout.current;
    el?.classList.add('is-on');
    window.setTimeout(() => {
      journey.scrollToProgress(SKIP_TO, { immediate: true });
      window.setTimeout(() => el?.classList.remove('is-on'), 300);
    }, 450);
  }, []);

  return (
    <>
      <a href="#flat" className="skiplink" onClick={() => useExperience.getState().setMode('flat')}>
        Skip to the simple page
      </a>
      <OpeningVideo />
      <TopBar onSkip={skip} showSkip={skipVisible && beforeSkip} showAutoplay />
      <Hero />
      {BEATS.filter((b) => b.narration).map((b) => (
        <Narration key={b.id} beat={b} />
      ))}
      {BEATS.filter((b) => b.hud).map((b) => (
        <HudCaption key={b.id} beat={b} />
      ))}
      {SCIENCES.map((s) => (
        <SciencePanel key={s.id} science={s} />
      ))}
      <EarthFacts />
      <FactPanel beatId="voyager" data={VOYAGER} />
      <LearnMore />
      <ProgressRail />
      <MobileProgress />
      <UpNext />
      {loaded && <ResumePrompt />}
      <div ref={blackout} className="blackout" aria-hidden />
    </>
  );
}

/**
 * The opening: standing on Earth under the Milky Way (the night-sky footage).
 * Scrolling pushes in and up through the sky until the footage dissolves and
 * the camera is above the whole planet.
 */
function OpeningVideo() {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  useProgressStyle(wrap, (p) => ({ o: 1 - smooth(local(p, 0.008, 0.034)), s: 1 + smooth(local(p, 0, 0.034)) * 0.45 }));
  useProgressStyle(mark, (p) => ({ o: 1 - smooth(local(p, 0.002, 0.018)), y: -local(p, 0, 0.02) * 40 }));
  useEffect(
    () =>
      useExperience.subscribe((s) => {
        const v = video.current;
        if (!v) return;
        if (s.progress < 0.04) void v.play().catch(() => {});
        else v.pause();
      }),
    [],
  );
  return (
    <>
      <div ref={wrap} className="opening" aria-hidden>
        <video ref={video} className="opening__video" src="/assets/video/nightsky-wide.mp4" poster="/assets/video/nightsky-wide.jpg" muted playsInline loop autoPlay preload="auto" />
        <div className="opening__shade" />
      </div>
      <div ref={mark} className="opening__mark">
        <p className="hud-label">A journey through the rules of the universe</p>
        <h2 className="display display--xl">{HERO.wordmark}</h2>
        <Gate />
        <p className="scrollcue">
          <span>Or scroll</span>
          <i />
        </p>
      </div>
    </>
  );
}

/**
 * The way in, edolus-style: one framed action that also turns the sound on (the
 * click is the gesture browsers need for audio), and a quieter one for visitors
 * who would rather watch. Scrolling still works for anyone who just scrolls.
 */
function Gate() {
  const soundOn = () => {
    void requestTilt();
    const st = useExperience.getState();
    if (st.muted) {
      st.setMuted(false);
      audio.setEnabled(true);
      track('audio_unmute');
    }
  };
  return (
    <div className="gate">
      <button
        type="button"
        className="btn btn--primary btn--lg btn--bracket"
        onClick={() => {
          soundOn();
          track('skip_intro', { via: 'gate-begin' });
          journey.scrollToProgress(0.06, { duration: 3.2 });
        }}
      >
        Begin the journey
      </button>
      <button
        type="button"
        className="gate__alt"
        onClick={() => {
          soundOn();
          useExperience.getState().setAutoplay(true);
          track('autoplay_on');
        }}
      >
        ▶ Or let it play
      </button>
      <p className="gate__phones">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="14" width="4" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="17" y="14" width="4" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        Best with headphones
      </p>
    </div>
  );
}

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  useProgressStyle(ref, (p) => ({ o: envelope(p, 0.04, 0.058, 0.098, 0.112), y: (1 - smooth(local(p, 0.04, 0.065))) * 28 }));
  return (
    <div ref={ref} className="cine-hero">
      <p className="hud-label">Helix Labs</p>
      <h2 className="display display--l">{HERO.headline}</h2>
      <p className="cine-hero__sub">{HERO.subline}</p>
      <div className="cine-hero__ctas">
        <a className="btn btn--primary btn--lg btn--bracket" href={signUpHref('hero')} onClick={() => track('signup_click', { source: 'hero' })}>
          {HERO.cta}
        </a>
        <button type="button" className="btn btn--ghost btn--lg" onClick={() => journey.scrollToProgress(0.15, { duration: 3 })}>
          Begin the journey ↓
        </button>
      </div>
    </div>
  );
}

function windowOf(beat: Beat, w: readonly [number, number]) {
  const [a, b] = beat.range;
  return [a + (b - a) * w[0], a + (b - a) * w[1]] as const;
}

function Narration({ beat }: { beat: Beat }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [s, e] = windowOf(beat, beat.narrationWindow ?? [0.15, 0.85]);
  const f = (e - s) * 0.22;
  useProgressStyle(ref, (p) => ({ o: envelope(p, s, s + f, e - f, e), y: (0.5 - local(p, s, e)) * 22 }));
  return (
    <p ref={ref} className={`narration narration--${beat.id}`}>
      {beat.narration}
    </p>
  );
}

/** Mono caption naming what you're looking at — the edolus-style HUD. */
function HudCaption({ beat }: { beat: Beat }) {
  const ref = useRef<HTMLDivElement>(null);
  const [s, e] = windowOf(beat, [0.15, 0.95]);
  useProgressStyle(ref, (p) => ({ o: envelope(p, s, s + 0.006, e - 0.006, e) }));
  const chapter = CHAPTERS.findIndex((c) => c.id === beat.chapter) + 1;
  return (
    <div ref={ref} className="hud" aria-hidden>
      <span className="hud__chapter">
        {String(chapter).padStart(2, '0')} / {String(CHAPTERS.length).padStart(2, '0')}
      </span>
      <span className="hud__title">{beat.hud!.title}</span>
      <span className="hud__line">{beat.hud!.line}</span>
    </div>
  );
}

/**
 * Phones present a panel one idea at a time (edolus-style): the headline, then
 * each fact in turn replacing the last. Marks which step is current for the
 * scroll position; the portrait CSS shows only that one. Desktop ignores it.
 */
function markStep(els: (HTMLElement | null)[], p: number, s: number, e: number) {
  const t = (p - s) / Math.max(1e-6, e - s);
  const n = els.length;
  const idx = t < 0.1 ? -1 : Math.min(n - 1, Math.floor(((t - 0.1) / 0.86) * n));
  els.forEach((el, i) => el?.classList.toggle('is-current', i === idx));
}

function SciencePanel({ science }: { science: Science }) {
  const beat = beatById(science.id);
  const [a, b] = beat.range;
  const s = a + (b - a) * 0.2;
  const e = a + (b - a) * 0.92;
  const ref = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const lawRefs = useRef<(HTMLLIElement | null)[]>([]);
  const lifeRef = useRef<HTMLParagraphElement>(null);
  const isBio = science.id === 'biology';
  const end = isBio ? a + (b - a) * 0.67 : e;

  useProgressStyle(ref, (p) => ({ o: envelope(p, s, s + 0.008, end - 0.006, end), y: (1 - smooth(local(p, s, s + 0.012))) * 40 }));
  useEffect(
    () =>
      useExperience.subscribe((st) => {
        const p = st.progress;
        // laws reveal one by one as you scroll through the beat
        lawRefs.current.forEach((el, i) => {
          if (!el) return;
          const gap = (end - s) * 0.16;
          const k = smooth(local(p, s + gap * (0.3 + i), s + gap * (1.1 + i)));
          el.style.opacity = String(k);
          el.style.transform = `translateX(${(1 - k) * -18}px)`;
          el.style.filter = `blur(${(1 - k) * 6}px)`;
        });
        markStep([...lawRefs.current, lifeRef.current], p, s, end);
        const v = video.current;
        if (v) {
          if (p > s - 0.01 && p < end + 0.01) void v.play().catch(() => {});
          else v.pause();
        }
      }),
    [s, end],
  );

  return (
    <section ref={ref} className={`science science--${science.id}`} style={{ visibility: 'hidden' }} aria-labelledby={`sci-${science.id}`}>
      <p className="hud-label">
        <span className="science__index">{science.index}</span> {science.lab}
        <span className="science__place"> · {science.place}</span>
      </p>
      <h2 id={`sci-${science.id}`} className="display display--m">
        {science.title}
      </h2>
      <ul className="science__laws">
        {science.laws.map((l, i) => (
          <li key={l.name} ref={(el) => void (lawRefs.current[i] = el)}>
            <span className="science__law">{l.name}</span>
            <span className="science__line">{l.line}</span>
            {l.formula && <span className="science__formula">{l.formula}</span>}
          </li>
        ))}
      </ul>
      {science.video && !isBio && (
        <figure className="science__video">
          <video ref={video} src={science.video.src} poster={science.video.poster} muted playsInline loop preload="none" />
          <figcaption>{science.video.caption}</figcaption>
        </figure>
      )}
      {science.legend && <p className="science__legend">{science.legend}</p>}
      <p ref={lifeRef} className="science__life">
        <span>Why it keeps us alive</span>
        {science.life}
      </p>
      <a className="science__link" href={signUpHref(`science-${science.id}`)} onClick={() => track('signup_click', { source: `science-${science.id}` })}>
        Enter {science.lab} <span aria-hidden>→</span>
      </a>
    </section>
  );
}

/** Second half of the biology beat: why Earth is special, over the living-city footage. */
function EarthFacts() {
  const beat = beatById('biology');
  const [a, b] = beat.range;
  const s = a + (b - a) * 0.69;
  // stays up until the final section arrives (it fades in from 0.952): no empty frame, no overlap
  const e = 0.9545;
  const ref = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const bio = SCIENCES.find((x) => x.id === 'biology')!;
  const steps = useRef<(HTMLElement | null)[]>([]);
  useProgressStyle(ref, (p) => ({ o: envelope(p, s, s + 0.006, e - 0.005, e), y: (1 - smooth(local(p, s, s + 0.01))) * 30 }));
  useEffect(
    () =>
      useExperience.subscribe((st) => {
        markStep(steps.current, st.progress, s, e);
        const v = video.current;
        if (!v) return;
        if (st.progress > s - 0.01 && st.progress < e) void v.play().catch(() => {});
        else v.pause();
      }),
    [s, e],
  );
  return (
    <section ref={ref} className="science science--facts" style={{ visibility: 'hidden' }} aria-labelledby="earth-special">
      <p className="hud-label">
        <span className="science__index">04</span> Why Earth is special
      </p>
      <h2 id="earth-special" className="display display--m">
        The only place we know where the rules made life.
      </h2>
      <ul className="facts">
        {EARTH_FACTS.map((f, i) => (
          <li key={f} ref={(el) => void (steps.current[i] = el)}>
            {f}
          </li>
        ))}
      </ul>
      <p ref={(el) => void (steps.current[EARTH_FACTS.length] = el)} className="science__precious">
        {PRECIOUS}
      </p>
      {bio.video && (
        <figure className="science__video">
          <video ref={video} src={bio.video.src} poster={bio.video.poster} muted playsInline loop preload="none" />
          <figcaption>{bio.video.caption}</figcaption>
        </figure>
      )}
    </section>
  );
}

/** Voyager: centred on screen, with the reasons it matters revealed one by one. */
function FactPanel({ beatId, data }: { beatId: string; data: typeof VOYAGER }) {
  const beat = beatById(beatId);
  const [a, b] = beat.range;
  const s = a + (b - a) * 0.12;
  const e = a + (b - a) * 0.88;
  const ref = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  useProgressStyle(ref, (p) => ({ o: envelope(p, s, s + 0.006, e - 0.006, e), y: (1 - smooth(local(p, s, s + 0.01))) * 30 }));
  useEffect(
    () =>
      useExperience.subscribe((st) => {
        const gap = (e - s) * 0.16;
        items.current.forEach((el, i) => {
          if (!el) return;
          const k = smooth(local(st.progress, s + gap * (0.4 + i), s + gap * (1.1 + i)));
          el.style.opacity = String(k);
          el.style.transform = `translateX(${(1 - k) * -16}px)`;
          el.style.filter = `blur(${(1 - k) * 5}px)`;
        });
        markStep(items.current, st.progress, s, e);
      }),
    [s, e],
  );
  return (
    <section ref={ref} className="science science--voyager" style={{ visibility: 'hidden' }} aria-labelledby={`${beatId}-h`}>
      <p className="hud-label">
        <span className="science__index">✦</span> {data.kicker}
      </p>
      <h2 id={`${beatId}-h`} className="display display--m">
        {data.title}
      </h2>
      <ul className="science__laws">
        {data.facts.map((f, i) => (
          <li key={f.k} ref={(el) => void (items.current[i] = el)}>
            <span className="science__law">{f.k}</span>
            <span className="science__line">{f.v}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The invitation, over the lighthouse footage. */
function LearnMore() {
  const ref = useRef<HTMLDivElement>(null);
  // phones in portrait get the portrait cuts of the same footage
  const [tall] = useState(() => typeof window !== 'undefined' && window.innerWidth < window.innerHeight);
  const vids = useRef<(HTMLVideoElement | null)[]>([]);
  const [shot, setShot] = useState(0);
  const [active, setActive] = useState(false);
  useProgressStyle(ref, (p) => ({ o: smooth(local(p, 0.952, 0.972)) }));
  useEffect(() => useExperience.subscribe((s) => setActive(s.progress > 0.944)), []);
  // a slow montage: lighthouse → city traffic → city at dusk
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setShot((n) => (n + 1) % LEARN_MONTAGE.length), 5200);
    return () => window.clearInterval(id);
  }, [active]);
  useEffect(() => {
    vids.current.forEach((v, i) => {
      if (!v) return;
      if (active && i === shot) void v.play().catch(() => {});
      else if (!active) v.pause();
    });
  }, [active, shot]);
  return (
    <section ref={ref} className="learn" style={{ visibility: 'hidden' }} aria-labelledby="learn-h">
      {LEARN_MONTAGE.map((m, i) => (
        <video
          key={m.src}
          ref={(el) => void (vids.current[i] = el)}
          className={`learn__video ${i === shot ? 'is-on' : ''}`}
          src={tall ? m.portrait : m.src}
          poster={tall ? m.portraitPoster : m.poster}
          muted
          playsInline
          loop
          preload="none"
          aria-hidden
        />
      ))}
      <p className="learn__caption" aria-hidden>
        {LEARN_MONTAGE[shot]!.caption}
      </p>
      <div className="learn__shade" aria-hidden />
      <div className="learn__inner">
        <p className="hud-label">{LEARN.eyebrow}</p>
        <h2 id="learn-h" className="display display--l">
          {LEARN.title}
        </h2>
        <p className="learn__body">{LEARN.body}</p>
        <div className="learn__ctas">
          <a className="btn btn--primary btn--xl" href={signUpHref('learn')} onClick={() => track('signup_click', { source: 'learn' })}>
            {LEARN.cta}
          </a>
          <a className="btn btn--ghost btn--lg" href="#labs">
            {LEARN.secondary}
          </a>
        </div>
        <ul className="learn__labs">
          {LABS.map((l) => (
            <li key={l.id} style={{ ['--c' as string]: l.color }}>
              {l.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Phones: the scenes worth stopping for, in order. A label comes from the beat's
 * caption ("Saturn", "Voyager 1") or its lab; the target is the beat's first
 * held frame (where its panel reads best).
 */
const MOMENTS = BEATS.flatMap((b) => {
  const label = b.hud?.title ?? SCIENCES.find((s) => s.id === b.id)?.lab ?? (b.id === 'learn' ? 'The labs' : null);
  if (!label) return [];
  const [a, z] = b.range;
  const hold = b.camera.find((k) => k.hold)?.at ?? 0.4;
  return [{ id: b.id, label, at: a + (z - a) * hold, start: a }];
});

/** Phones: a slim progress line and the chapter you are in, so the journey always has a shape. */
function MobileProgress() {
  const fill = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      useExperience.subscribe((s) => {
        if (fill.current) fill.current.style.transform = `scaleX(${scrollFromStory(s.progress)})`;
        const beat = BEATS.find((b) => b.id === s.activeBeat);
        const i = Math.max(0, CHAPTERS.findIndex((c) => c.id === beat?.chapter));
        if (label.current) label.current.textContent = `${String(i + 1).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')} · ${CHAPTERS[i]!.label}`;
        if (wrap.current) wrap.current.style.opacity = s.progress > 0.03 && s.progress < 0.95 ? '1' : '0';
      }),
    [],
  );
  return (
    <div ref={wrap} className="mprogress" aria-hidden style={{ opacity: 0 }}>
      <div className="mprogress__track">
        <div ref={fill} className="mprogress__fill" />
      </div>
      <span ref={label} className="mprogress__label" />
    </div>
  );
}

/**
 * Phones: pause for a moment and the next scene is named, with a tap to fly
 * there (or let the rest play). Curiosity does the scrolling.
 */
function UpNext() {
  const [next, setNext] = useState<(typeof MOMENTS)[number] | null>(null);
  useEffect(() => {
    let timer = 0;
    const show = () => {
      const st = useExperience.getState();
      if (st.autoplay || st.progress < 0.03 || st.progress > 0.94) return setNext(null);
      setNext(MOMENTS.find((m) => m.start > st.progress + 0.004) ?? null);
    };
    let last = useExperience.getState().progress;
    const unsub = useExperience.subscribe((s) => {
      if (Math.abs(s.progress - last) < 1e-5 && !s.autoplay) return;
      last = s.progress;
      setNext(null);
      window.clearTimeout(timer);
      timer = window.setTimeout(show, 1700);
    });
    timer = window.setTimeout(show, 2500);
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, []);
  if (!next) return null;
  return (
    <div className="upnext" role="group" aria-label="Up next">
      <button type="button" className="upnext__go" onClick={() => journey.scrollToProgress(next.at, { duration: 2.2 })}>
        <span className="upnext__k">Next</span> {next.label} <i aria-hidden>↓</i>
      </button>
      <button type="button" className="upnext__play" aria-label="Let the rest play" onClick={() => useExperience.getState().setAutoplay(true)}>
        ▶
      </button>
    </div>
  );
}

function ProgressRail() {
  const fill = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      useExperience.subscribe((s) => {
        if (fill.current) fill.current.style.transform = `scaleY(${scrollFromStory(s.progress)})`;
      }),
    [],
  );
  return (
    <nav className="rail" aria-label="Journey chapters">
      <div className="rail__track">
        <div ref={fill} className="rail__fill" />
      </div>
      {CHAPTERS.map((m, i) => (
        <button key={m.id} type="button" className="rail__mark" style={{ top: `${scrollFromStory(m.at) * 100}%` }} onClick={() => journey.scrollToProgress(m.at, { duration: 2.4 })}>
          <span>
            {String(i + 1).padStart(2, '0')} {m.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

/** "Resume, don't restart": a small mission log of where the visitor left off. */
function ResumePrompt() {
  const [at, setAt] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const r = readResume();
    if (r && useExperience.getState().progress < 0.02) {
      setAt(r);
      track('resume_offered', { at: +r.toFixed(3) });
    }
  }, []);
  const close = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => setAt(null), 450);
  }, []);
  // scrolling on means "from the beginning": get out of the way
  useEffect(() => {
    if (at === null) return;
    return useExperience.subscribe((s) => {
      if (s.progress > 0.03 && s.progress < at - 0.02) close();
    });
  }, [at, close]);
  if (at === null) return null;
  const ci = Math.max(0, CHAPTERS.findLastIndex((c) => at >= c.at - 0.02));
  const ch = CHAPTERS[ci];
  // the scene they were watching, by its on-screen title
  const scene = [...BEATS].reverse().find((b) => b.hud && b.range[0] <= at + 0.005)?.hud?.title ?? ch?.label ?? 'The journey';
  const pct = Math.round(scrollFromStory(at) * 100);
  return (
    <div className={`resume ${leaving ? 'is-leaving' : ''}`} role="dialog" aria-label="Continue your journey">
      <i className="resume__corner resume__corner--tl" aria-hidden />
      <i className="resume__corner resume__corner--br" aria-hidden />
      <span className="resume__eyebrow">
        <span className="resume__pulse" aria-hidden />
        Journey saved
      </span>
      <p className="resume__title">
        You stopped at <b>{scene}</b>
      </p>
      <div className="resume__meter" aria-hidden>
        <i style={{ transform: `scaleX(${pct / 100})` }} />
        {CHAPTERS.map((c) => (
          <span key={c.id} style={{ left: `${scrollFromStory(c.at) * 100}%` }} />
        ))}
      </div>
      <span className="resume__meta">
        Chapter {String(ci + 1).padStart(2, '0')} of {String(CHAPTERS.length).padStart(2, '0')} · {ch?.label} · {pct}% through
      </span>
      <div className="resume__row">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            track('resume_accepted', { at: +at.toFixed(3) });
            journey.scrollToProgress(at, { immediate: true });
            close();
          }}
        >
          Continue
        </button>
        <button
          type="button"
          className="resume__restart"
          onClick={() => {
            clearResume();
            close();
          }}
        >
          From the beginning
        </button>
      </div>
    </div>
  );
}
