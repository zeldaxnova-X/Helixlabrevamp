/**
 * Conversion instrumentation — vendor-neutral.
 *
 * Every event is pushed to `window.dataLayer` (so GTM / GA4 / Vercel Analytics can
 * pick it up) and, if NEXT_PUBLIC_ANALYTICS_URL is set, beaconed to that endpoint
 * (e.g. the api.helixlabs.pro/ingest function from the platform plan).
 *
 * Landing-page events are anonymous: a random per-tab session id, no PII, no
 * cross-site identifiers. That keeps this page clear of the DPDP tracking rules
 * for minors — the visitor may be a child.
 *
 * Key funnel:  experience_mode → beat_reached(*) → lab_interact → signup_click
 * The number that matters: signup_click / page_view.
 */

export type EventName =
  | 'page_view'
  | 'experience_mode'
  | 'mode_override'
  | 'beat_reached'
  | 'scroll_complete'
  | 'skip_intro'
  | 'resume_offered'
  | 'resume_accepted'
  | 'audio_unmute'
  | 'autoplay_on'
  | 'lab_interact'
  | 'signup_click'
  /** Left for the other build (today: this one → the lite edition). */
  | 'edition_switch'
  | 'perf_downgrade';

type Props = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

let sid: string | null = null;
const session = () => {
  if (sid) return sid;
  try {
    sid = sessionStorage.getItem('helix:sid');
    if (!sid) {
      sid = Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem('helix:sid', sid);
    }
  } catch {
    sid = 'nostorage';
  }
  return sid;
};

const once = new Set<string>();

export function track(event: EventName, props: Props = {}, opts: { once?: boolean } = {}) {
  if (typeof window === 'undefined') return;
  const key = event + JSON.stringify(props);
  if (opts.once) {
    if (once.has(key)) return;
    once.add(key);
  }
  const payload = { event, ...props, sid: session(), t: Math.round(performance.now()) };
  (window.dataLayer ??= []).push(payload);

  const url = process.env.NEXT_PUBLIC_ANALYTICS_URL;
  if (url) {
    try {
      navigator.sendBeacon(url, JSON.stringify({ source: 'landing', ...payload }));
    } catch {}
  } else if (process.env.NODE_ENV !== 'production') {
    console.debug('[track]', payload);
  }
}
