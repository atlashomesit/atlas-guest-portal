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

export function formatEstTotalInclGst(
  perNight: number,
  nights: number,
  formatCurrency: (amount: number, options?: { maximumFractionDigits?: number }) => string,
): string {
  const stayNights = Math.max(1, nights);
  const gstPct = accommodationGstSlabPercent(perNight) ?? 5;
  const gstMult = gstPct === 18 ? 1.18 : 1.05;
  const total = Math.round(perNight * stayNights * gstMult);
  const nightLabel = stayNights === 1 ? '1 night' : `${stayNights} nights`;
  return `${formatCurrency(total, { maximumFractionDigits: 0 })} est. total incl. ${gstPct}% GST (${nightLabel})`;
}
