import type { MetadataRoute } from 'next';

/**
 * Let everything in, and let the canonical tag do the deciding.
 *
 * This edition is served from a vercel.app address and names
 * www.helixlabs.pro as its canonical, so the two builds are not competing for
 * the same results — the signal points one way, at the production domain.
 *
 * That only works if crawlers are allowed to fetch these pages and read the
 * tag. Disallowing them here would leave the duplicate unresolved rather than
 * resolved, which is the opposite of what it looks like it does.
 *
 * There is no sitemap for the same reason: every URL here defers to one on
 * another host, and a sitemap of addresses that all point elsewhere is not a
 * useful thing to hand anybody. The canonical site has its own.
 */
export default function robots(): MetadataRoute.Robots {
  // Two things nobody should find in a search result: the holding page that
  // grants nothing, and /preview, which is a dev-only model inspector. Both
  // belong in the same group as the wildcard allow — two separate
  // "User-Agent: *" blocks is ambiguous, and crawlers merge them differently.
  const closed = ['/early-access', '/preview'];

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: closed },
      // Named for the record rather than for effect — the wildcard above
      // already covers them. The list mirrors the canonical site's, which
      // carries the longer explanation of why each is welcome.
      {
        disallow: closed,
        userAgent: [
          'Googlebot',
          'Bingbot',
          'DuckDuckBot',
          'Applebot',
          'OAI-SearchBot',
          'ChatGPT-User',
          'Claude-User',
          'Claude-SearchBot',
          'PerplexityBot',
          'Perplexity-User',
          'GPTBot',
          'ClaudeBot',
          'Google-Extended',
          'Applebot-Extended',
          'CCBot',
          'meta-externalagent',
          'Amazonbot',
        ],
        allow: '/',
      },
    ],
  };
}
