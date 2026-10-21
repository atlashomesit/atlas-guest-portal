/**
 * Founder ruling 2026-10-21 (website price honesty): the first price a guest sees is the price they pay,
 * with the direct-booking saving shown —
 *
 *   ₹5,998 (struck)  ₹4,499 / night
 *   25% off — booked direct
 *   ₹4,633 total · 1 night · all fees included
 *
 * Every number comes from the checkout quote (`GET /api/pricing/guest-breakdown`, or the daily-summary row the
 * API now builds from that same quote). Before this, cards showed the standard rate (₹5,998) and the 25% only
 * came off on the last screen, so guests left believing the higher price was real.
 */
export type DirectPriceDisplay = {
  /** Standard nightly rate before the direct-booking discount — shown struck through. Null when there is no saving. */
  standardNightly: number | null;
  /** What one night really costs the guest, before the payment fee. */
  realNightly: number;
  /** Whole-percent saving against the standard rate; 0 when there is none. */
  savingsPercent: number;
  /** All-in total the guest is charged for the stay (payment fee and any tourist tax included). */
  total: number;
  nights: number;
};

export type DirectPriceQuote = {
  /** Stay price before the direct-booking discount (the quote's BaseAmount). */
  baseAmount: number;
  /** The direct-booking discount the quote applies (the quote's DiscountAmount). */
  discountAmount: number;
  /** The quote's all-in FinalAmount. Falls back to base − discount when missing. */
  finalAmount: number | null | undefined;
  nights: number;
  /**
   * TASK-10298998: false when no online gateway will charge this guest (`hasOnlinePaymentRail()` — a
   * WhatsApp hand-off or pay-at-property host). The quote's FinalAmount still carries the 3% payment fee
   * (`feeMode` CustomerPays), but nothing on the site ever charges it, so the all-in total must leave it out
   * — exactly as the booking box does (TASK-7428: no processor, no fee). Defaults to true.
   */
  paymentFeeCharged?: boolean;
  /** The payment fee inside `finalAmount` (the quote's ConvenienceFeeAmount); removed when `paymentFeeCharged` is false. */
  paymentFeeAmount?: number | null;
};

export function directPriceDisplay(quote: DirectPriceQuote | null | undefined): DirectPriceDisplay | null {
  if (!quote) return null;
  const nights = Math.max(1, Math.round(Number(quote.nights) || 1));
  const base = Number(quote.baseAmount) || 0;
  if (base <= 0) return null;
  const discount = Math.min(base, Math.max(0, Number(quote.discountAmount) || 0));
  const net = base - discount;
  const final = Number(quote.finalAmount);
  const quotedTotal = Number.isFinite(final) && final > 0 ? final : net;
  const fee = Math.max(0, Number(quote.paymentFeeAmount) || 0);
  // No gateway, no fee: take the payment fee back out of the quote's all-in total (never below the room price).
  const total =
    quote.paymentFeeCharged === false && Number.isFinite(final) && final > 0
      ? Math.max(net, final - fee)
      : quotedTotal;
  const savingsPercent = discount > 0 ? Math.round((discount / base) * 100) : 0;
  return {
    standardNightly: savingsPercent > 0 ? Math.round(base / nights) : null,
    realNightly: Math.round(net / nights),
    savingsPercent,
    total: Math.round(total),
    nights,
  };
}

/** "25% off — booked direct" — the one wording every surface uses for the saving. */
export function directSavingsLabel(savingsPercent: number): string {
  return `${savingsPercent}% off — booked direct`;
}

/** "₹4,633 total · 1 night · all fees included" */
export function allInTotalLabel(totalFormatted: string, nights: number): string {
  return `${totalFormatted} total · ${nights} ${nights === 1 ? 'night' : 'nights'} · all fees included`;
}

/**
 * Plain words for a plan's meals (founder ruling 2026-10-21: no "Room Only" / "CP" / "MAP" jargon).
 * Takes the API's MealPlanLabel ("Room Only", "Breakfast Included", "Half Board (Breakfast & Dinner)", …).
 */
export function plainMealLabel(label: string | null | undefined): string {
  const l = (label ?? '').trim().toLowerCase();
  if (!l || l === 'room only') return 'Room only, no meals';
  if (l.startsWith('breakfast')) return 'Breakfast included';
  if (l.startsWith('half board')) return 'Breakfast and dinner included';
  if (l.startsWith('full board')) return 'All meals included';
  if (l.startsWith('all inclusive')) return 'All meals and drinks included';
  return (label ?? '').trim();
}
