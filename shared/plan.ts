/**
 * What is on sale. One file, three repositories, byte for byte the same.
 *
 * Helix Labs is three deployments — the journey, the lite site and the LMS —
 * and only one of them can charge anybody. That makes the price a shared
 * fact, and a shared fact kept in three places is a shared fact that drifts:
 * a marketing page promising 19 while the gateway asks for 399 is not a
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
 * To change the price: edit AMOUNT_PAISE here, copy this file into the other
 * two repositories, deploy the LMS first, then the marketing sites, then run
 * check:plan on both.
 */

/**
 * Paise, because that is how Razorpay counts money.
 *
 * Rupees with a decimal point is how a rounding error gets into the one
 * number nobody may get wrong, so the integer is the source and rupees are
 * derived from it.
 *
 * ₹19 is the introductory price while the payment path is proved end to end
 * on the live site. Real pricing is ₹399 (39900).
 */
export const AMOUNT_PAISE = 1900;

/** How many days one payment buys. Nothing renews on its own. */
export const DAYS = 30;

export const CURRENCY = 'INR';
export const PLAN_ID = 'monthly';
export const PLAN_NAME = 'Monthly';

/** ₹19 as a number, for arithmetic and for schema.org. */
export const RUPEES = AMOUNT_PAISE / 100;

/** ₹1,299 rather than ₹1299 — a price is read, not parsed. */
export const priceLabel = (paise: number = AMOUNT_PAISE) =>
  (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * Every figure above in one string.
 *
 * This is what crosses the wire between the deployments, so that a check is
 * one comparison rather than four, and so that adding a field here can never
 * be silently missed by the check.
 */
export const FINGERPRINT = `${PLAN_ID}:${AMOUNT_PAISE}:${CURRENCY}:${DAYS}`;
