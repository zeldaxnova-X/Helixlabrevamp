import { CREDITS, EARTH_FACTS, HERO, LABS, LEARN, SCHOOLS, SCIENCES, signUpHref, URLS } from '@/content/site';
import { ModeSwitcher } from './ModeSwitcher';

/**
 * The flat landing page — server-rendered, fully functional, fast.
 *
 * It is (1) the whole site for no-WebGL visitors and anyone who picks "simple
 * page", (2) what Google, link previews and screen readers read in every mode,
 * and (3) in the cinematic/mobile modes, the outro (the six labs, schools,
 * footer) the journey scrolls into. The intro is visually hidden but kept
 * accessible while an experience is running (see .flat-intro in CSS).
 */
export function FlatLanding() {
  return (
    <div id="flat" className="flat">
      <div className="flat-intro">
        <header className="flat-nav">
          <a href="#top" className="flat-nav__mark">
            <span>{HERO.wordmark}</span>
          </a>
          <nav aria-label="Main">
            <a href="#rules">The rules</a>
            <a href="#labs">Labs</a>
            <a href="#schools">Schools</a>
            <a className="btn btn--primary" href={signUpHref('flat-nav')}>
              {HERO.cta}
            </a>
          </nav>
        </header>

        <section className="flat-hero" aria-labelledby="flat-h1">
          <div className="flat-hero__bg" aria-hidden />
          <div className="flat-hero__inner">
            <p className="hud-label">Helix Labs</p>
            <h1 id="flat-h1" className="display display--l">
              {HERO.headline}
            </h1>
            <p className="flat-hero__sub">{HERO.subline}</p>
            <div className="flat-hero__ctas">
              <a className="btn btn--primary btn--lg" href={signUpHref('flat-hero')}>
                {HERO.cta}
              </a>
              <a className="btn btn--ghost btn--lg" href="#rules">
                See the rules
              </a>
            </div>
          </div>
        </section>

        <section id="rules" className="flat-section" aria-labelledby="rules-h">
          <h2 id="rules-h" className="display display--m">
            One planet. Every part of it runs on rules.
          </h2>
          <p className="flat-lede">The same few laws built the stars, keep the Moon in orbit and make you alive. Each Helix lab is where you learn one by playing with it.</p>
          <div className="flat-sciences">
            {SCIENCES.map((s) => (
              <article key={s.id}>
                <p className="hud-label">
                  <span className="science__index">{s.index}</span> {s.lab}
                </p>
                <h3>{s.title}</h3>
                <ul>
                  {s.laws.map((l) => (
                    <li key={l.name}>
                      <b>{l.name}</b>
                      {l.line} {l.formula && <code>{l.formula}</code>}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
            <article>
              <p className="hud-label">
                <span className="science__index">✦</span> Why Earth is special
              </p>
              <h3>The only place we know where the rules made life.</h3>
              <ul>
                {EARTH_FACTS.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>
      </div>

      <div className="flat-outro">
        <section id="labs" className="flat-section" aria-labelledby="labs-h">
          <h2 id="labs-h" className="display display--m">
            Six labs. One universe to understand.
          </h2>
          <div className="flat-grid">
            {LABS.map((l) => (
              <article key={l.id} className="flat-card" style={{ ['--c' as string]: l.color }}>
                <p className="flat-card__kind">{l.core ? 'Core science' : 'Supplementary lab'}</p>
                <h3>{l.name}</h3>
                <p className="flat-card__rule">{l.rule}</p>
                <p>{l.blurb}</p>
                <ul>
                  {l.modules.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                <a href={signUpHref('flat-card', { lab: l.id })} className="flat-card__link">
                  Enter {l.name} →
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="flat-learn" aria-labelledby="flat-learn-h">
          <div className="flat-learn__bg" aria-hidden />
          <div className="flat-section">
            <p className="hud-label">{LEARN.eyebrow}</p>
            <h2 id="flat-learn-h" className="display display--m">
              {LEARN.title}
            </h2>
            <p className="flat-lede">{LEARN.body}</p>
            <a className="btn btn--primary btn--xl" href={signUpHref('flat-learn')}>
              {LEARN.cta}
            </a>
          </div>
        </section>

        <section id="schools" className="flat-section flat-schools" aria-labelledby="schools-h">
          <div>
            <h2 id="schools-h" className="display display--m">
              {SCHOOLS.title}
            </h2>
            <p>{SCHOOLS.blurb}</p>
          </div>
          <a className="btn btn--ghost btn--lg" href={signUpHref('schools', { intent: 'school' })}>
            {SCHOOLS.cta}
          </a>
        </section>

        <footer className="flat-footer">
          <div className="flat-footer__row">
            <a href="#top" className="flat-nav__mark">
              <span>{HERO.wordmark}</span>
            </a>
            <ModeSwitcher />
          </div>
          <ul className="flat-footer__credits">
            {CREDITS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="flat-footer__fine">© {new Date().getFullYear()} Helix Labs · helixlabs.pro</p>
        </footer>
      </div>
    </div>
  );
}
