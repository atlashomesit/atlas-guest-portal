/**
 * GUEST-048: small guest-copy helpers, kept pure so the two property layouts and the home page share one rule.
 */

/**
 * "Save ~₹N by booking directly" amount, or null when there is no positive price to compute it from.
 * The caller renders the block only when this is non-null. It used to be `price && price > 0 && <block>`, which paints a bare "0" under the booking box when the price is 0.
 */
export function saveVsOtaAmount(propertyPrice: number | null | undefined): number | null {
  if (typeof propertyPrice !== 'number' || !Number.isFinite(propertyPrice) || propertyPrice <= 0) return null;
  return Math.round(propertyPrice * 2 * 0.155);
}

/** A brand name with its trailing full stops removed, so "Grove & Co." followed by "." never reads "Grove & Co..". */
export function brandNameForSentence(brandName: string): string {
  return brandName.trim().replace(/\.+$/, '');
}
