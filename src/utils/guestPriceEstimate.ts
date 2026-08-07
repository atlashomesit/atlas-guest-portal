/** TASK-2903 / TASK-2870: shared GST + est-total for guest pricing surfaces. */

export const ACCOMMODATION_GST_THRESHOLD_INR = 7500;

/** Indian accommodation GST slab (5% ≤₹7,500/night, 18% above — eff. 22 Sep 2025). */
export function accommodationGstSlabPercent(perNight: number): number | null {
  if (perNight <= 0) return null;
  return perNight <= ACCOMMODATION_GST_THRESHOLD_INR ? 5 : 18;
}

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
 * `accommodationGstSlabPercent` above (2 bands, no exempt tier) is a separate, still-open gap used
 * only by `UnitBookingWidget`'s and `computeCheckoutTotal`'s client-side FALLBACK paths (used only
 * while a server quote is loading or unavailable) — both already band off a discounted/charged
 * per-night figure there, just without the 0% exempt tier. That gap is orthogonal to the
 * published-vs-charged basis fixed here (TASK-7540 did not touch it) and remains out of scope.
 *
 * KEEP THIS IN SYNC with `GstInvoiceConstants.cs` if that table ever changes — nothing enforces
 * the two stay aligned automatically; this comment is the enforcement.
 */
export function accommodationGstSlabPercentForChargedRate(chargedPerNight: number): number | null {
  if (chargedPerNight <= 0) return null;
  if (chargedPerNight <= ACCOMMODATION_GST_EXEMPT_THRESHOLD_INR) return 0;
  return chargedPerNight <= ACCOMMODATION_GST_THRESHOLD_INR ? 5 : 18;
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
 *
 * TASK-7543: `perNight` is the rate the guest actually pays (post-discount) and is what the fare,
 * the GST *band*, and the fee are all computed from — matching
 * `GstInvoiceCalculation.ResolveCheckoutAccommodationGstPercentForChargedBase`, which now bands
 * off that same charged value. `chargedPerNight` defaults to `perNight` and should be left at its
 * default for nearly every caller; only pass something else when you have an independent,
 * already-REAL (never published/sticker) per-night figure to bias the band toward — e.g.
 * RecentlyViewedPage.tsx compares today's live price against a previously-viewed price. Never pass
 * a pre-discount published rate here — that was the TASK-7011-era convention; TASK-7540 fixed the
 * last callers still doing it (see `accommodationGstSlabPercentForChargedRate`'s doc comment).
 */
export function estTotalInclGst(
  perNight: number,
  nights: number,
  convenienceFeePercent: number = 3,
  isGstRegistered: boolean = true, // TASK-4312: respect listing's GST registration status
  chargedPerNight: number = perNight,
): number {
  const stayNights = Math.max(1, nights);
  // TASK-4312: if listing is not GST-registered, no GST is charged; otherwise apply slab rate.
  // TASK-7543: slab is selected off the CHARGED (post-discount) rate, matching the server — see
  // accommodationGstSlabPercentForChargedRate's doc comment.
  const gstPct = isGstRegistered ? (accommodationGstSlabPercentForChargedRate(chargedPerNight) ?? 5) : 0;
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
  chargedPerNight: number = perNight, // TASK-7543: see estTotalInclGst's doc comment
): string {
  const stayNights = Math.max(1, nights);
  const gstPct = isGstRegistered ? (accommodationGstSlabPercentForChargedRate(chargedPerNight) ?? 5) : 0;
  const total = estTotalInclGst(perNight, stayNights, convenienceFeePercent, isGstRegistered, chargedPerNight);
  const nightLabel = stayNights === 1 ? '1 night' : `${stayNights} nights`;
  const gstLabel = gstPct > 0 ? `incl. ${gstPct}% GST + ` : '';
  return `${formatCurrency(total, { maximumFractionDigits: 0 })} est. total ${gstLabel}3% payment processing (${nightLabel})`;
}
