/**
 * Where every link on the journey goes.
 *
 * Helix Labs is three deployments and a visitor should never be able to tell:
 *
 *   SELF  journey.helixlabs.pro — this build, the 3D journey
 *   LITE  www.helixlabs.pro — the lite edition, and the site's front door
 *   APP   lms.helixlabs.pro — sign-in, payment, and the labs themselves
 *
 * Each is overridable from the environment so a preview deployment can point
 * at other previews without a code change. The fallbacks are the real
 * production addresses rather than development ports: if a variable is
 * missing on a deploy, every call to action still lands somewhere real
 * instead of on the visitor's own machine.
 *
 * This file replaces the holding-page link that used to sit in content/site.ts.
 * That link existed because the old sign-up handed anybody an account for
 * nothing, so no button here was allowed to reach it. That is no longer true:
 * the LMS gates every lab behind a paid entitlement checked in middleware, so
 * the buttons may now go where they always should have — at the real thing.
 */

const trim = (u: string) => u.replace(/\/+$/, '');

export const SELF = trim(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://journey.helixlabs.pro');
export const LITE = trim(process.env.NEXT_PUBLIC_LITE_URL ?? 'https://www.helixlabs.pro');
export const APP = trim(process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.helixlabs.pro');

function tagged(base: string, path: string, params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  return `${base}${path}${q ? `?${q}` : ''}`;
}

/**
 * Into sign-in with the plan already chosen, and billing waiting on the far
 * side of it.
 *
 * There is no free tier, so every call to action on this site is an intent to
 * buy and this is where nearly all of them go. `plan` is a hint carried
 * across so the visitor does not choose twice; the LMS decides the amount
 * from its own copy of shared/plan.ts and never from this link.
 */
export function checkoutHref(source: string, extra: Record<string, string> = {}) {
  return tagged(APP, '/sign-in', { plan: 'monthly', from: `journey:${source}`, next: '/billing', ...extra });
}

/** Into the product, for somebody who already has an account. */
export function labsHref(source: string, extra: Record<string, string> = {}) {
  return tagged(APP, '/', { from: `journey:${source}`, ...extra });
}

export function signInHref(source: string) {
  return tagged(APP, '/sign-in', { from: `journey:${source}` });
}

/**
 * Across to the lite edition, tagged with where the visitor left from.
 *
 * The two editions have to be able to walk into each other's domain, and the
 * handshake is in the URL rather than in storage: localStorage never crosses
 * an origin, so nothing here pretends it does.
 */
export function liteHref(source: string) {
  return tagged(LITE, '/', { from: `journey:${source}` });
}

/**
 * Schools are a conversation rather than a button, so they get a page of
 * their own. It keeps the /early-access address: the lite edition links to
 * it, and a URL that has been handed out is not worth breaking to tidy a
 * folder name.
 */
export function schoolsHref(source: string) {
  return tagged('', '/early-access', { from: `journey:${source}` });
}
