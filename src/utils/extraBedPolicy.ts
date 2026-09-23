/**
 * TASK-102396 — infant/child extra-bed policy for direct checkout.
 *
 * Board defect: pricing treated every guest over capacity identically, so 2 Adults +
 * 1 infant (6 months) auto-added the full adult extra-bed surcharge (₹1,500/night).
 *
 * Required semantics: infants under 2 years stay free and never trigger extra-bed fees;
 * only children/adults beyond the listing's base capacity do.
 */

export const INFANT_FREE_AGE_YEARS = 2;

export type ExtraBedGuestCounts = {
  adults: number;
  children: number;
  /** Infants under 2 years — always free, never count toward bedding capacity. */
  infants: number;
};

export function billableGuestsForBedding(counts: ExtraBedGuestCounts): number {
  const adults = Math.max(0, Math.floor(counts.adults));
  const children = Math.max(0, Math.floor(counts.children));
  return adults + children;
}

export function extraBedsRequired(counts: ExtraBedGuestCounts, baseCapacity: number): number {
  return Math.max(0, billableGuestsForBedding(counts) - Math.max(0, Math.floor(baseCapacity)));
}

export function shouldChargeExtraBed(counts: ExtraBedGuestCounts, baseCapacity: number): boolean {
  return extraBedsRequired(counts, baseCapacity) > 0;
}

export function extraBedNightsTotal(
  counts: ExtraBedGuestCounts,
  baseCapacity: number,
  feePerNight: number,
  nights: number,
): number {
  const beds = extraBedsRequired(counts, baseCapacity);
  if (beds <= 0) return 0;
  return beds * Math.max(0, feePerNight) * Math.max(0, nights);
}
