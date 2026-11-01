/**
 * GUEST-048 / GUEST-037: small guest-copy helpers, kept pure so the two property layouts and the home page share one rule.
 *
 * GUEST-037: the fixed "Save ~₹N by booking directly" (2 nights x 15.5%) helper was removed. Atlas holds no real OTA price for a stay, so a saving figure would be invented; do not reintroduce one unless a quote field carries a measured comparison.
 */

/** A brand name with its trailing full stops removed, so "Grove & Co." followed by "." never reads "Grove & Co..". */
export function brandNameForSentence(brandName: string): string {
  return brandName.trim().replace(/\.+$/, '');
}
