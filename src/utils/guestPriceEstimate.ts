/** TASK-2903 / TASK-2870: shared GST + est-total for guest pricing surfaces. */

export const ACCOMMODATION_GST_THRESHOLD_INR = 7500;

/** TASK-5112 / TASK-7011: INR per-night threshold at/below which accommodation is GST-exempt
 * (nil-rated) — mirrors `GstInvoiceConstants.AccommodationExemptSlabThresholdInrPerNight`. */
export const ACCOMMODATION_GST_EXEMPT_THRESHOLD_INR = 1000;

/**
 * TASK-7011 (basis superseded by TASK-7543, 2026-08-07 founder ruling): the server's REAL
 * accommodation GST slab table — three bands, not two. Mirrors, band-for-band:
 *   `Atlas.Api/Constants/GstInvoiceConstants.cs` (`AccommodationExemptSlabThresholdInrPerNight` =
 *   ₹1,000, `AccommodationSlabThresholdInrPerNight` = ₹7,500, rates 0% / 5% / 18%) and
 *   `Atlas.Api/Services/GstInvoiceCalculation.cs#ResolveAccommodationGstRate`.
 * Boundary semantics match the server exactly: ≤₹1,000 → 0% (exempt), ₹1,000.01–₹7,500 → 5%,
 * >₹7,500 → 18%.
 *
 * TASK-7543: the BASIS this table is keyed from changed. Until 2026-08-07 the server picked its
 * band from the listing's pre-discount published/sticker rate; a founder ruling that day moved
 * checkout banding onto the CHARGED (post-discount) per-night value instead — see
 * `GstInvoiceCalculation.ResolveCheckoutAccommodationGstPercentForChargedBase`, called after every
 * discount so checkout and the invoice (already on the charged basis since TASK-7200) select the
 * SAME band from the SAME number. The input here must now be the CHARGED per-night rate a guest
 * actually pays — passing the published/sticker rate (the previous, TASK-7011-era convention) is
 * exactly the client/server disagreement TASK-7540 fixed; do not reintroduce it.
 *
 * TASK-8294: this is now the ONLY accommodation GST slab function in this file and every caller —
 * including `UnitBookingWidget`'s and `computeCheckoutTotal`'s client-side FALLBACK paths (used
 * only while a server quote is loading or unavailable) — must use it. A two-band sibling
 * (`accommodationGstSlabPercent`, no exempt tier) used to live here and was the still-open gap
 * those fallback paths hit: a sub-₹1,000/night stay would be quoted a "GST (5%)" line that legally
 * does not exist for that stay. It has been deleted rather than fixed-in-place, specifically
 * because two near-identically-named helpers where only one is correct is itself the hazard — do
 * not reintroduce a second slab helper; add new bands to this one.
 * KEEP THIS IN SYNC with `GstInvoiceCalculation.ResolveAccommodationGstRate` (TASK-101988) —
 * exempt band is strictly below ₹1,000 (< 1000). Exactly ₹1,000 is 5%.
 */
export function accommodationGstSlabPercentForChargedRate(chargedPerNight: number): number | null {
  if (chargedPerNight <= 0) return null;
  if (chargedPerNight < ACCOMMODATION_GST_EXEMPT_THRESHOLD_INR) return 0;
  return chargedPerNight <= ACCOMMODATION_GST_THRESHOLD_INR ? 5 : 18;
}

/** Additive GST on room fare (CPO-canonical formula). */
export function accommodationGstLineAmount(baseAmount: number, perNight: number): number {
  const pct = accommodationGstSlabPercentForChargedRate(perNight);
  if (pct == null || baseAmount <= 0) return 0;
  // TASK-8294: an exempt (0%) stay must show no GST line at all — the pre-existing ₹1 floor below
  // exists only so a genuinely-taxed line never rounds down to a misleading ₹0; it must not apply
  // when there is legally no tax to floor.
  if (pct === 0) return 0;
  return Math.max(1, Math.round((baseAmount * pct) / 100));
}

/**
 * TASK-4831: Checkout total for GuestDetailsPage.
 *
 * The two-step booking flow stores a server-authoritative `finalAmount` on the hold breakdown
 * (UnitBookingWidget → BookingContext.holdPriceBreakdown). `finalAmount` = base − discount + GST +
 * convenience fee for the base stay, computed by the same server path (PricingService →
 * RazorpayPaymentService) that builds the real Razorpay order amount.
 *
 * Historically GuestDetailsPage ignored `finalAmount` and re-derived the GST slab client-side from a
 * per-night rate. Near the ₹7,500/night slab boundary (long-stay / last-minute pricing) the client
 * slab decision disagreed with the server, so the /details total diverged from the listing widget and
 * from the Razorpay order — surfacing only as the jarring "total updated — tap Pay again" gate.
 *
 * This helper prefers the server `finalAmount` for the base-stay total and backs the GST line out of it
 * so the displayed line items (base − discount, GST, convenience fee) sum exactly to `finalAmount`. It
 * falls back to the client slab recompute only when no server `finalAmount` is available. Add-ons, promo,
 * and referral discounts are applied only at the final-charge step, so they are layered on top of the
 * base-stay total.
 */
export type CheckoutTotalInput = {
  baseAmount: number;
  globalDiscountAmount: number;
  convenienceFeeAmount: number;
  nights: number;
  /** Server-authoritative base-stay total from the hold breakdown; null/≤0 when unavailable. */
  serverFinalAmount: number | null;
  /** TASK-5185: tourism tax already inside serverFinalAmount — must not be folded into GST. */
  touristTaxAmount?: number;
  addOnsTotal: number;
  promoDiscountAmount: number;
  referralDiscountAmount: number;
};

export type CheckoutTotalBreakdown = {
  discountedSubtotal: number;
  perNight: number;
  gstSlabPercent: number | null;
  gstLineAmount: number;
  touristTaxAmount: number;
  /** base − discount + GST + convenience fee + tourist tax (server `finalAmount` when available). */
  baseStayTotal: number;
  displayTotal: number;
};

export function computeCheckoutTotal(input: CheckoutTotalInput): CheckoutTotalBreakdown {
  const {
    baseAmount,
    globalDiscountAmount,
    convenienceFeeAmount,
    nights,
    serverFinalAmount,
    touristTaxAmount: touristTaxInput = 0,
    addOnsTotal,
    promoDiscountAmount,
    referralDiscountAmount,
  } = input;

  // TASK-4421: global discount applies before fee; per-night uses the post-discount base.
  const discountedSubtotal = Math.max(0, baseAmount - globalDiscountAmount);
  const perNight = nights > 0 ? Math.round(discountedSubtotal / nights) : 0;
  const touristTaxAmount = Math.max(0, Number(touristTaxInput) || 0);

  // TASK-102037 (ADR-0107): Zero GST added on top at guest checkout time.
  const gstLineAmount = 0;
  const gstSlabPercent = null;

  const hasServerFinal = typeof serverFinalAmount === 'number' && serverFinalAmount > 0;

  const baseStayTotal = hasServerFinal
    ? (serverFinalAmount as number)
    : discountedSubtotal + convenienceFeeAmount + touristTaxAmount;

  const displayTotal = Math.max(
    1,
    baseStayTotal + addOnsTotal - promoDiscountAmount - referralDiscountAmount,
  );

  return {
    discountedSubtotal,
    perNight,
    gstSlabPercent,
    gstLineAmount,
    touristTaxAmount,
    baseStayTotal,
    displayTotal,
  };
}

export function estimateStayNights(checkIn: Date | null, checkOut: Date | null): number {
  if (!checkIn || !checkOut || checkOut.getTime() <= checkIn.getTime()) return 1;
  const days = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

/**
 * TASK-102037 (ADR-0107): single source of truth for the guest est-total number.
 * Zero GST added on top at checkout time.
 * Room fare × nights, plus the payment-processing fee.
 */
export function estTotal(
  perNight: number,
  nights: number,
  convenienceFeePercent: number = 3,
): number {
  const stayNights = Math.max(1, nights);
  const baseTotal = perNight * stayNights;
  const convenienceFee = Math.round((baseTotal * convenienceFeePercent) / 100);
  return Math.round(baseTotal + convenienceFee);
}

export function formatEstTotal(
  perNight: number,
  nights: number,
  formatCurrency: (amount: number, options?: { maximumFractionDigits?: number }) => string,
  convenienceFeePercent: number = 3,
): string {
  const stayNights = Math.max(1, nights);
  const total = estTotal(perNight, stayNights, convenienceFeePercent);
  const nightLabel = stayNights === 1 ? '1 night' : `${stayNights} nights`;
  const feeLabel = convenienceFeePercent > 0 ? `${convenienceFeePercent}% payment processing ` : '';
  return `${formatCurrency(total, { maximumFractionDigits: 0 })} est. total ${feeLabel}(${nightLabel})`.trim();
}

/** Legacy aliases retained for zero-GST compatibility (ADR-0107) */
export function estTotalInclGst(
  perNight: number,
  nights: number,
  convenienceFeePercent: number = 3,
  _isGstRegistered: boolean = true,
  _chargedPerNight: number = perNight,
): number {
  return estTotal(perNight, nights, convenienceFeePercent);
}

export function formatEstTotalInclGst(
  perNight: number,
  nights: number,
  formatCurrency: (amount: number, options?: { maximumFractionDigits?: number }) => string,
  convenienceFeePercent: number = 3,
  _isGstRegistered: boolean = true,
  _chargedPerNight: number = perNight,
): string {
  return formatEstTotal(perNight, nights, formatCurrency, convenienceFeePercent);
}
