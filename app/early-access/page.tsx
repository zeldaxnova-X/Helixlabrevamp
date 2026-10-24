import type { Metadata } from 'next';
import Link from 'next/link';
import { HERO } from '@/content/site';

/**
 * Where every call to action lands until the new build has its own sign-up.
 *
 * It deliberately grants nothing. The old build's sign-up let anyone make an
 * account with any password and use the labs for free, so no button on this
 * site may hand out an account until sign-up sits behind a paid entitlement.
 */
export const metadata: Metadata = {
  title: 'Early access | Helix Labs',
  description: 'The Helix Labs labs are not open yet.',
  robots: { index: false, follow: true },
};

export default function EarlyAccessPage() {
  return (
    <main className="gate-page">
      <div className="gate-page__body">
        <span className="gate-page__eyebrow">{HERO.wordmark}</span>
        <h1 className="gate-page__title">The labs are not open yet</h1>
        <p className="gate-page__lede">
          We are rebuilding Helix Labs from the ground up, and access opens with the new release. Nothing is on sale here yet and no
          account is being created.
        </p>
        <p className="gate-page__note">In the meantime the journey is the whole story of what the labs teach. It is worth the scroll.</p>
        <Link className="btn btn--primary btn--lg" href="/?voyage=1">
          Back to the journey
        </Link>
      </div>
    </main>
  );
}
