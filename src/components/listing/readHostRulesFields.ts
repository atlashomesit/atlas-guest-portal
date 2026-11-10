/** GUEST-069: the host's rules and map link from a public-listing payload, as the property pages carry them (null when absent or blank). */
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function readHostRulesFields(listing: Record<string, unknown>): {
  houseRulesText: string | null;
  houseRulesPdfUrl: string | null;
  houseRulesStructured: string | null;
  googleMapsUrl: string | null;
} {
  return {
    houseRulesText: str(listing.houseRulesText ?? listing.HouseRulesText),
    houseRulesPdfUrl: str(listing.houseRulesPdfUrl ?? listing.HouseRulesPdfUrl),
    houseRulesStructured: str(listing.houseRulesStructured ?? listing.HouseRulesStructured),
    googleMapsUrl: str(listing.googleMapsUrl ?? listing.GoogleMapsUrl),
  };
}
