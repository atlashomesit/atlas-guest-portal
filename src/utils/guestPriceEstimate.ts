/** TASK-2903 / TASK-2870: shared GST + est-total for guest pricing surfaces. */

export const ACCOMMODATION_GST_THRESHOLD_INR = 7500;

/** Indian accommodation GST slab (5% ≤₹7,500/night, 18% above — eff. 22 Sep 2025). */
export function accommodationGstSlabPercent(perNight: number): number | null {
  if (perNight <= 0) return null;
  return perNight <= ACCOMMODATION_GST_THRESHOLD_INR ? 5 : 18;
}

/** Additive GST on room fare (CPO-canonical formula). */
export function accommodationGstLineAmount(baseAmount: number, perNight: number): number {
  const pct = accommodationGstSlabPercent(perNight);
  if (pct == null || baseAmount <= 0) return 0;
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

  // TASK-4421: global discount applies before GST; per-night slab decision uses the post-discount base.
  const discountedSubtotal = Math.max(0, baseAmount - globalDiscountAmount);
  const perNight = nights > 0 ? Math.round(discountedSubtotal / nights) : 0;
  const touristTaxAmount = Math.max(0, Number(touristTaxInput) || 0);

  const clientSlabPercent = accommodationGstSlabPercent(perNight);
  const clientGstLineAmount =
    clientSlabPercent != null && discountedSubtotal > 0
      ? accommodationGstLineAmount(discountedSubtotal, perNight)
      : 0;

  const hasServerFinal = typeof serverFinalAmount === 'number' && serverFinalAmount > 0;

  // Back the GST line out of the authoritative finalAmount so
  // base + GST + convenience fee + tourist tax == finalAmount.
  // Guard the legacy path (TASK-4286) where convenienceFeeAmount is a client fallback not baked into
  // finalAmount, which would make the backed-out GST negative — there, keep the client slab estimate for
  // the line while the total still prefers finalAmount.
  // TASK-5185: subtract tourist tax before attributing the remainder to GST (else Goa 5%+5% shows as "GST 10%").
  const derivedGst = hasServerFinal
    ? Math.round(
        (serverFinalAmount as number) - discountedSubtotal - convenienceFeeAmount - touristTaxAmount,
      )
    : null;
  const useServerGst = derivedGst != null && derivedGst >= 0;

  const gstLineAmount = useServerGst ? (derivedGst as number) : clientGstLineAmount;
  const gstSlabPercent =
    useServerGst && discountedSubtotal > 0 && gstLineAmount > 0
      ? Math.round((gstLineAmount / discountedSubtotal) * 100)
      : clientSlabPercent;

  const baseStayTotal = hasServerFinal
    ? (serverFinalAmount as number)
    : discountedSubtotal + clientGstLineAmount + convenienceFeeAmount + touristTaxAmount;

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
 * TASK-4832: single source of truth for the guest est-total number.
 * Room fare × nights, plus slab GST (skipped when the host isn't GST-registered),
 * plus the payment-processing fee — the exact amount rendered both in the collapsed
 * estimate line and the expanded "See total" figure, so a card toggle never shows
 * two different money totals.
 */
export function estTotalInclGst(
  perNight: number,
  nights: number,
  convenienceFeePercent: number = 3,
  isGstRegistered: boolean = true, // TASK-4312: respect listing's GST registration status
): number {
  const stayNights = Math.max(1, nights);
  // TASK-4312: if listing is not GST-registered, no GST is charged; otherwise apply slab rate
  const gstPct = isGstRegistered ? (accommodationGstSlabPercent(perNight) ?? 5) : 0;
  const gstMult = gstPct === 18 ? 1.18 : gstPct === 5 ? 1.05 : 1.0;
  const baseTotal = perNight * stayNights;
  const withGst = Math.round(baseTotal * gstMult);
  // TASK-4302 / TASK-4312: include payment processing fee in the displayed total.
  // TASK-4913 (founder-ruled 2026-07-17, option c): fee is 3% of BASE only, not base+GST.
  const convenienceFee = Math.round((baseTotal * convenienceFeePercent) / 100);
  return Math.round(withGst + convenienceFee);
}

export function formatEstTotalInclGst(
  perNight: number,
  nights: number,
  formatCurrency: (amount: number, options?: { maximumFractionDigits?: number }) => string,
  convenienceFeePercent: number = 3,
  isGstRegistered: boolean = true, // TASK-4312: respect listing's GST registration status
): string {
  const stayNights = Math.max(1, nights);
  // TASK-4312: if listing is not GST-registered, no GST is charged; otherwise apply slab rate
  const gstPct = isGstRegistered ? (accommodationGstSlabPercent(perNight) ?? 5) : 0;
  const total = estTotalInclGst(perNight, stayNights, convenienceFeePercent, isGstRegistered);
  const nightLabel = stayNights === 1 ? '1 night' : `${stayNights} nights`;
  const gstLabel = gstPct > 0 ? `incl. ${gstPct}% GST + ` : '';
  return `${formatCurrency(total, { maximumFractionDigits: 0 })} est. total ${gstLabel}3% payment processing (${nightLabel})`;
}
