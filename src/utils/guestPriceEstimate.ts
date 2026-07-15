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
  // TASK-4302 / TASK-4312: include payment processing fee (3% of base+GST) in the displayed total
  const convenienceFee = Math.round((withGst * convenienceFeePercent) / 100);
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
