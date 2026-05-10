import type { PublicListing } from "@/api/listingClient";

/**
 * TASK-1479: `GET /listings/public` does not yet support `?city=` — match listings client-side
 * using address and titles against curated keywords for each destination.
 */
export function listingMatchesCityKeywords(
  listing: PublicListing,
  keywords: readonly string[],
): boolean {
  const hay = [listing.propertyAddress, listing.propertyName, listing.name]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" ")
    .toLowerCase();
  if (!hay) return false;
  return keywords.some((k) => {
    const t = k.trim().toLowerCase();
    return t.length > 0 && hay.includes(t);
  });
}
