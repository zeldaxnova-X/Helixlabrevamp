import { ANNUAL_PLAN, FREE_PLAN, MONTHLY_PLAN, PLANS as TIERS, PRICE_NOTICE, type PlanId, rupeesOf } from '@/shared/plan';

/**
 * What the journey says about buying Helix Labs.
 *
 * Deliberately short. The lite edition at www.helixlabs.pro is the commercial
 * front door and carries the full pricing page, the FAQ and every policy;
 * this build's job is the story, and the pricing section at the end of it
 * exists so that somebody who has just been flown from the Big Bang to a
 * pale blue dot is not then made to go and look for the price.
 *
 * Nothing here states a figure as a literal. The prices come from
 * shared/plan.ts — the same file the LMS reads to decide what to charge — so
 * this page and the payment window cannot disagree. `npm run check:plan`
 * proves it against the live gateway.
 */

export const SUPPORT_EMAIL = 'hello@helixlabs.pro';

/** ₹1,299 rather than ₹1299 — a price is read, not parsed. */
export const rupees = (n: number) => n.toLocaleString('en-IN');

export const PRICING = {
  eyebrow: 'Three ways in',
  title: 'Six labs. One of them free.',
  lede: 'The journey you have just taken is the first hour. The labs are where you take the rules apart yourself — starting with one physics lab that costs nothing at all.',
  /* The price is appended by whoever renders this, from the tiers below, so
     that the figure in a button label can never be a stale literal. */
  cta: 'Start now',
  secondary: 'Full pricing and FAQ',
  note: 'Prices are in Indian rupees and include GST. No setup fee, nothing added at checkout, and no card kept on file afterwards.',
  rise: PRICE_NOTICE,
} as const;

export interface Tier {
  id: PlanId;
  name: string;
  /** rupees, inclusive of GST. 0 is the free tier, which has no checkout. */
  price: number;
  per: string;
  term: string;
  cta: string;
  featured: boolean;
}

/**
 * The three tiers, read from the shared file in the order it lists them.
 *
 * Only the words are written here — every figure and every term comes across
 * from shared/plan.ts, so a price change in one repository cannot leave this
 * page advertising last month's.
 */
export const TIER_COPY: Record<PlanId, { cta: string; featured: boolean }> = {
  free: { cta: 'Start free', featured: false },
  monthly: { cta: 'Take a month', featured: true },
  annual: { cta: 'Take the year', featured: false },
};

export const PRICING_TIERS: Tier[] = TIERS.map((p) => ({
  id: p.id,
  name: p.name,
  price: rupeesOf(p),
  per: p.per,
  term: p.term,
  ...TIER_COPY[p.id],
}));

/** For the one place a single headline figure is wanted. */
export const MONTHLY_PRICE = rupeesOf(MONTHLY_PLAN);
export const ANNUAL_PRICE = rupeesOf(ANNUAL_PLAN);
export const FREE_TERM = FREE_PLAN.term;

/**
 * What a paid tier includes.
 *
 * The same six lines the lite edition shows, because they describe the same
 * product and a visitor may well read both pages before deciding.
 */
export const INCLUDED = [
  'All six labs — physics, chemistry, biology, maths, AI & ML and aptitude',
  'Every module in every lab, including the ones added while you are subscribed',
  'Simulations, 3D models, games and quizzes, not video lectures',
  'Progress saved across devices, so a lab picks up where it was left',
  'Works in any modern browser — no install, no console, no graphics card',
  'One account for one learner',
];
