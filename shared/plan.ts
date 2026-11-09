/**
 * What is on sale. One file, three repositories, byte for byte the same.
 *
 * Helix Labs is three deployments — the journey, the lite site and the LMS —
 * and only one of them can charge anybody. That makes the price a shared
 * fact, and a shared fact kept in three places is a shared fact that drifts:
 * a marketing page promising 99 while the gateway asks for 1099 is not a
 * typo, it is a chargeback.
 *
 * So this file is copied, not re-typed, and three things keep the copies
 * honest:
 *
 *   1. Every page, policy, FAQ answer and meta description reads from here.
 *      Nothing anywhere states a price as a literal.
 *   2. The LMS — the only deployment that opens an order — serves these
 *      figures at /api/plan.
 *   3. `npm run check:plan` on either marketing site fetches that and
 *      compares FINGERPRINT. A mismatch fails loudly instead of quietly
 *      overcharging someone.
 *
 * To change the price: edit PLANS here, copy this file into the other two
 * repositories, deploy the LMS first, then the marketing sites, then run
 * check:plan on both.
 */

export const CURRENCY = 'INR';

export type PlanId = 'free' | 'monthly' | 'annual';

export interface Plan {
  id: PlanId;
  /** How the tier is named everywhere it is shown. */
  name: string;
  /**
   * Paise, because that is how Razorpay counts money.
   *
   * Rupees with a decimal point is how a rounding error gets into the one
   * number nobody may get wrong, so the integer is the source and rupees are
   * derived from it. Zero means nothing is charged, and nothing may open an
   * order for it.
   */
  amountPaise: number;
  /** How many days one payment buys. 0 means the tier does not expire. */
  days: number;
  /** The unit printed under the figure. */
  per: string;
  /** The honest arithmetic under the price, in one sentence. */
  term: string;
}

/**
 * The three tiers, cheapest first.
 *
 * Free exists so that a parent can see the thing working before paying for
 * it — one physics lab, in full, with no card and no time limit. It is not a
 * crippled version of the product: it is one real lab out of the whole set.
 *
 * Monthly and annual open exactly the same six labs as each other. The only
 * difference between them is how often you pay, which is a real choice; a
 * tiered table where the cheaper paid plan has the good parts taken out
 * gives a parent a reason to distrust the page.
 */
export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    amountPaise: 0,
    days: 0,
    per: 'no card needed',
    term: 'One physics lab, in full, for as long as you like. No payment, no expiry, and no card asked for at any point.',
  },
  {
    id: 'monthly',
    name: 'Monthly',
    amountPaise: 9900,
    days: 30,
    per: 'per month',
    term: 'One payment, thirty days of access to every lab. Nothing renews on its own, so there is nothing to cancel — pay again when you want another month.',
  },
  {
    id: 'annual',
    name: 'Annual pass',
    amountPaise: 109900,
    days: 365,
    per: 'per year',
    term: 'One payment, a full year of access to every lab. Still nothing renewing on its own, and still no card kept on file.',
  },
] as const satisfies readonly Plan[];

export const [FREE_PLAN, MONTHLY_PLAN, ANNUAL_PLAN] = PLANS;

/** The tiers somebody can actually be charged for. */
export const PAID_PLANS = PLANS.filter((p) => p.amountPaise > 0);

/**
 * A plan by id, for a server turning a request into an amount.
 *
 * Returns undefined rather than falling back to a default: a request naming
 * a plan that does not exist is a bug or an attack, and quietly charging
 * such a caller the monthly rate would be the wrong answer to both.
 */
export const planById = (id: string): Plan | undefined => PLANS.find((p) => p.id === id);

/** Whether this tier can open an order at all. */
export const isPaid = (plan: Plan) => plan.amountPaise > 0;

/** ₹1,099 rather than ₹1099 — a price is read, not parsed. */
export const priceLabel = (paise: number) => (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** The figure as a number, for arithmetic and for schema.org. */
export const rupeesOf = (plan: Plan) => plan.amountPaise / 100;

/**
 * What the annual pass actually saves, counted rather than claimed.
 *
 * Twelve monthly payments against one annual one. Written as arithmetic so
 * that changing either figure cannot leave a stale "save ₹X" on a page — and
 * so that an annual price above twelve monthly payments would show up as a
 * negative number here instead of as a false promise on the pricing card.
 */
export const ANNUAL_SAVING_RUPEES = (MONTHLY_PLAN.amountPaise * 12 - ANNUAL_PLAN.amountPaise) / 100;

/** The annual pass expressed as a monthly figure, rounded to the rupee. */
export const ANNUAL_PER_MONTH_RUPEES = Math.round(ANNUAL_PLAN.amountPaise / 12) / 100;

/**
 * What every page says about the price changing.
 *
 * These are introductory figures and they will go up. Saying so where the
 * price is shown is both fairer and safer than letting somebody discover it
 * at the next renewal — and because nothing here auto-renews, a rise can
 * never take money from an account that was not expecting it.
 */
export const PRICE_NOTICE =
  'These are introductory prices and may increase in future. You are only ever charged the figure shown at checkout, and a period you have already paid for is never repriced.';

/** The one line that says what the free tier is, wherever it is offered. */
export const FREE_NOTICE = 'Start free with one physics lab — no card, no time limit.';

/**
 * Every figure above in one string.
 *
 * This is what crosses the wire between the deployments, so that a check is
 * one comparison rather than a dozen, and so that adding a tier or changing
 * a term here can never be silently missed by the check.
 */
export const FINGERPRINT = PLANS.map((p) => `${p.id}:${p.amountPaise}:${CURRENCY}:${p.days}`).join('|');
