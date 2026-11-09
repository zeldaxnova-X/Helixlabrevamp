import { DAYS, RUPEES } from '@/shared/plan';

/**
 * What the journey says about buying Helix Labs.
 *
 * Deliberately short. The lite edition at www.helixlabs.pro is the commercial
 * front door and carries the full pricing page, the FAQ and every policy;
 * this build's job is the story, and the pricing section at the end of it
 * exists so that somebody who has just been flown from the Big Bang to a
 * pale blue dot is not then made to go and look for the price.
 *
 * Nothing here states a figure as a literal. The price comes from
 * shared/plan.ts — the same file the LMS reads to decide what to charge — so
 * this page and the payment window cannot disagree. `npm run check:plan`
 * proves it against the live gateway.
 */

export const SUPPORT_EMAIL = 'hello@helixlabs.pro';

/** ₹1,299 rather than ₹1299 — a price is read, not parsed. */
export const rupees = (n: number = RUPEES) => n.toLocaleString('en-IN');

export const PRICING = {
  eyebrow: 'One subscription',
  title: 'Six labs. Everything unlocked.',
  lede: 'The journey you have just taken is the first hour. The labs are where you take the rules apart yourself — and there is one price for all of them.',
  price: RUPEES,
  per: 'per month',
  term: `One payment, ${DAYS} days of access. Nothing renews on its own, so there is nothing to cancel — pay again when you want another month.`,
  /* The price is appended by whoever renders this, from `price` above, so
     that the figure in the button label can never be a stale literal. */
  cta: 'Start now',
  secondary: 'Full pricing and FAQ',
  note: 'The price is in Indian rupees and includes GST. No setup fee, nothing added at checkout, and no card kept on file afterwards.',
} as const;

/**
 * What the subscription includes.
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
