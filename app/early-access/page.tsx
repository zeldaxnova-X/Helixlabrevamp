import type { Metadata } from 'next';
import Link from 'next/link';
import { HERO, SCHOOLS } from '@/content/site';
import { SUPPORT_EMAIL } from '@/content/commerce';
import { liteHref } from '@/lib/links';

/**
 * Schools, which are a conversation rather than a button.
 *
 * This was the holding page every call to action used to land on, back when
 * the labs were not on sale and no button here was allowed to hand anybody
 * an account. They are on sale now and the buttons go to the LMS, so the
 * page would otherwise sit here telling visitors the opposite — a parent
 * arriving from the lite edition's "Talk to us about schools" link would
 * have been told that nothing is for sale.
 *
 * It keeps the /early-access address rather than moving to /schools: the
 * lite edition links here and the URL has been handed out, and neither is
 * worth breaking to tidy a folder name.
 */
export const metadata: Metadata = {
  title: 'For schools | Helix Labs',
  description: 'Bulk accounts, a teacher console, class assignments and rostering. Helix Labs for a whole classroom.',
  // The lite edition is the canonical site and carries the indexed pages;
  // this is a contact page on the journey's domain, and two of them in the
  // results would only split the signal.
  robots: { index: false, follow: true },
};

export default function SchoolsPage() {
  const subject = encodeURIComponent('Helix Labs for our school');

  return (
    <main className="gate-page">
      <div className="gate-page__body">
        <span className="gate-page__eyebrow">{HERO.wordmark}</span>
        <h1 className="gate-page__title">{SCHOOLS.title}</h1>
        <p className="gate-page__lede">{SCHOOLS.blurb}</p>
        <p className="gate-page__note">
          Pricing for schools is worked out per seat and depends on the size of the cohort, so there is no button for
          it. Tell us the school, the year groups and roughly how many students, and a person will write back with a
          quote.
        </p>
        <a className="btn btn--primary btn--lg" href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}>
          Email {SUPPORT_EMAIL}
        </a>
        <p className="gate-page__note">
          Buying for one learner instead? <Link href="/#pricing">The subscription is on the main page</Link>, or see the{' '}
          <a href={liteHref('schools-page')}>full pricing and FAQ</a>.
        </p>
      </div>
    </main>
  );
}
