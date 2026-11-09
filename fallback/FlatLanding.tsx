import { CREDITS, EARTH_FACTS, ENTITY_LINE, HERO, LABS, LEARN, SCHOOLS, SCIENCES } from '@/content/site';
import { INCLUDED, PRICING, PRICING_TIERS, rupees } from '@/content/commerce';
import { checkoutHref, labsHref, liteHref, schoolsHref, signInHref } from '@/lib/links';
import { PaymentTrust } from '@/ui/PaymentTrust';
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
            <a href="#pricing">Pricing</a>
            <a href="#schools">Schools</a>
            {/* this page is what a visitor with no WebGL gets, so the lite
                edition — which is built for exactly that — belongs here */}
            <a href={liteHref('flat-nav')}>Lite version</a>
            <a className="btn btn--primary" href={checkoutHref('flat-nav')}>
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
              <a className="btn btn--primary btn--lg" href={checkoutHref('flat-hero')}>
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
                <a href={labsHref('flat-card', { lab: l.id })} className="flat-card__link">
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
            <a className="btn btn--primary btn--xl" href={checkoutHref('flat-learn')}>
              {LEARN.cta}
            </a>
          </div>
        </section>

        {/* ───────────────────────── pricing ─────────────────────────
            At the bottom, because this build's job is the story and the
            story has to be told before a price means anything. Every figure
            comes from shared/plan.ts, which the LMS reads to decide what to
            charge, so the numbers here and the number in the payment window
            are the same numbers. The buttons go to the LMS: sign in, then
            pay, then the labs — except the free one, which has nothing to
            pay for and so goes straight to sign-in. */}
        <section id="pricing" className="flat-section flat-pricing" aria-labelledby="pricing-h">
          <p className="hud-label hud-label--gold">{PRICING.eyebrow}</p>
          <h2 id="pricing-h" className="display display--m">
            {PRICING.title}
          </h2>
          <p className="flat-lede">{PRICING.lede}</p>

          <div className="flat-tiers">
            {PRICING_TIERS.map((t) => (
              <article className={`flat-tier${t.featured ? ' flat-tier--pick' : ''}`} key={t.id}>
                <p className="flat-tier__name">{t.name}</p>
                <p className="flat-plan__price">
                  <span className="flat-plan__cur">₹</span>
                  {rupees(t.price)}
                  <span className="flat-plan__per">{t.per}</span>
                </p>
                <p className="flat-plan__term">{t.term}</p>
                <a
                  className={`btn ${t.featured ? 'btn--primary' : ''} btn--lg`}
                  href={t.id === 'free' ? signInHref(`pricing-${t.id}`) : checkoutHref(`pricing-${t.id}`, { plan: t.id })}
                >
                  {t.cta}
                </a>
              </article>
            ))}
          </div>

          <div className="flat-plan">
            <p className="flat-tier__name">Both paid tiers include</p>
            <ul className="flat-plan__included">
              {INCLUDED.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>

          <PaymentTrust className="flat-trust" />

          <p className="flat-plan__note">
            {PRICING.note} {PRICING.rise} <a href={liteHref('pricing-detail')}>{PRICING.secondary}</a> · Already have an
            account? <a href={signInHref('pricing')}>Sign in</a>
          </p>
        </section>

        <section id="schools" className="flat-section flat-schools" aria-labelledby="schools-h">
          <div>
            <h2 id="schools-h" className="display display--m">
              {SCHOOLS.title}
            </h2>
            <p>{SCHOOLS.blurb}</p>
          </div>
          <a className="btn btn--ghost btn--lg" href={schoolsHref('flat-schools')}>
            {SCHOOLS.cta}
          </a>
        </section>

        <footer className="flat-footer">
          <div className="flat-footer__row">
            <a href="#top" className="flat-nav__mark">
              <span>{HERO.wordmark}</span>
            </a>
            <ModeSwitcher />
            <a className="flat-footer__edition" href={liteHref('flat-footer')}>
              Lite edition ↗
            </a>
          </div>
          <ul className="flat-footer__credits">
            {CREDITS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {/*
            No year: this page is prerendered, so `new Date()` would freeze at
            whatever day the site was last built and quietly go stale from the
            next January. Copyright does not depend on a date being shown, and
            reading one on the client would mean shipping JavaScript, and
            trusting the visitor's clock, to print it.
          */}
          <p className="flat-footer__fine">
            © Helix Labs · helixlabs.pro
            <br />
            {ENTITY_LINE}
          </p>
        </footer>
      </div>
    </div>
  );
}
