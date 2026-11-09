/**
 * Who handles the money, said plainly, wherever a price is shown.
 *
 * A parent about to put a card into a site they have never heard of is
 * deciding whether this is a real company. The honest reassurance is not that
 * Helix Labs is secure — it is that Helix Labs never touches the card at all:
 * the checkout is Razorpay's own, on Razorpay's page, and nothing but a
 * signed confirmation comes back here.
 *
 * So the claim is Razorpay's to make and it is made in Razorpay's words. We
 * do not describe ourselves as PCI DSS anything, because we are not the ones
 * certified; we say whose compliant checkout the card is typed into, which is
 * both the stronger statement and the true one.
 *
 * The badge is Razorpay's hosted image, with their `referrerpolicy="origin"`
 * kept as given — it is how they see which site is displaying it. Dark plate
 * for a dark page; the LMS, which has a light theme too, swaps it there.
 */
export function PaymentTrust({ className = '' }: { className?: string }) {
  return (
    <aside className={`trust ${className}`.trim()}>
      <a className="trust__badge" href="https://razorpay.com/" target="_blank" rel="noopener">
        <img
          referrerPolicy="origin"
          src="https://badges.razorpay.com/badge-dark.png"
          width={113}
          height={45}
          alt="Razorpay | Payment Gateway | Neobank"
        />
      </a>
      <div className="trust__copy">
        <p className="trust__head">Secure payments, handled by Razorpay</p>
        <p className="trust__line">
          Cards, UPI, net banking and wallets are entered on Razorpay&rsquo;s own PCI DSS compliant checkout. Those
          details never reach a Helix Labs server, and no card is kept on file afterwards.
        </p>
      </div>
    </aside>
  );
}
