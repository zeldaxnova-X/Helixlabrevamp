/**
 * Do the prices on this site match the prices the gateway will actually ask
 * for?
 *
 * Helix Labs is three deployments and only one of them — the LMS — can open
 * an order with Razorpay. The other two advertise its prices on pages it
 * never sees. shared/plan.ts is copied into all three so they agree by
 * construction, but a copy is only as good as the last person to copy it,
 * and the failure mode is a page promising 99 while the payment window asks
 * for 1099. That is not a typo; it is a chargeback and a bad review.
 *
 * So this asks the LMS directly and compares the one string that encodes
 * every figure of every tier. Run it after changing a price, and after
 * deploying.
 *
 *   npm run check:plan                              — against production
 *   APP_URL=http://localhost:3100 npm run check:plan
 *
 * It is deliberately not part of `build`: a marketing site that cannot be
 * deployed because another deployment is briefly unreachable is a worse
 * problem than the one being prevented.
 */
import { CURRENCY, FINGERPRINT, PLANS } from '../shared/plan.ts';

const app = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.helixlabs.pro').replace(/[/]+$/, '');
const url = `${app}/api/plan`;

/**
 * A failure sets the exit code and returns rather than calling process.exit.
 * Exiting hard while a socket is still closing trips an assertion in libuv on
 * Windows, and a check that reports a real mismatch and then appears to crash
 * is a check nobody will trust.
 */
let failed = false;
const die = (...lines) => {
  console.error('\n  ✗ ' + lines.join('\n    ') + '\n');
  failed = true;
};

/** What this site believes, one line per tier, for a readable diff. */
const ours = () => PLANS.map((p) => `  ${p.id.padEnd(8)} ${String(p.amountPaise).padStart(7)} paise · ${CURRENCY} · ${p.days} days`);

async function main() {
  let response;
  try {
    response = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (err) {
    return die(`Could not reach ${url}`, String(err?.message ?? err), 'The prices were not checked. This is not a pass.');
  }

  if (!response.ok) {
    await response.body?.cancel();
    return die(`${url} answered ${response.status}`, 'The prices were not checked. This is not a pass.');
  }

  let live;
  try {
    live = await response.json();
  } catch {
    return die(`${url} did not answer with JSON.`, 'If it answered with a sign-in page, /api/plan is missing from the middleware OPEN list.');
  }

  if (live.fingerprint === FINGERPRINT) {
    console.log(`\n  ✓ ${app} charges exactly what this site advertises, across all ${PLANS.length} tiers.`);
    console.log(ours().join('\n'));
    console.log('');
    return;
  }

  die(
    'The prices this site advertises are NOT the prices that will be charged.',
    '',
    `  this site  ${FINGERPRINT}`,
    `  the LMS    ${live.fingerprint ?? '(no fingerprint in the answer)'}`,
    '',
    ...ours(),
    '',
    'Copy shared/plan.ts from whichever repository is right into the other two,',
    'deploy the LMS first, then the marketing sites, then run this again.',
  );
}

await main();
if (failed) process.exitCode = 1;
