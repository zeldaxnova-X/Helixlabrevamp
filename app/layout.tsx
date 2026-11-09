import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import { EARLY_MODE_SCRIPT } from '@/fallback/capability';
import { HERO } from '@/content/site';
import { LITE, SELF } from '@/lib/links';
import './globals.css';

// One typeface for everything: Archivo at its widest, the way the wordmark is set.
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });

const title = 'Helix Labs | Learn the rules the universe runs on';
const description = `${HERO.headline} Interactive labs for physics, chemistry, biology and mathematics, plus AI and aptitude.`;

export const metadata: Metadata = {
  // This deployment's own origin, so that a relative OG image resolves on
  // the host actually serving it. The canonical is a separate, absolute
  // decision below rather than a side effect of this one.
  metadataBase: new URL(SELF),
  title,
  description,
  // The lite edition is the front door and the canonical page: the two
  // builds tell the same story in the same words, and pointing the signal at
  // one of them is what stops them competing with each other.
  alternates: { canonical: `${LITE}/` },
  openGraph: { title, description, url: '/', siteName: 'Helix Labs', images: [{ url: '/assets/images/og-sky.jpg', width: 1200, height: 630 }], type: 'website', locale: 'en_IN' },
  twitter: { card: 'summary_large_image', title, description, images: ['/assets/images/og-sky.jpg'] },
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = { themeColor: '#020309', colorScheme: 'dark', width: 'device-width', initialScale: 1 };

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'EducationalOrganization',
  name: 'Helix Labs',
  url: LITE,
  description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable} data-mode="pending" suppressHydrationWarning>
      <head>
        {/* Decide the layout before first paint so there's no flash of the wrong experience. */}
        <script dangerouslySetInnerHTML={{ __html: EARLY_MODE_SCRIPT }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body id="top">{children}</body>
    </html>
  );
}
