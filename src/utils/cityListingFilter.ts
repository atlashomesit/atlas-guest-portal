import type { PublicListing } from "@/api/listingClient";

/**
 * TASK-1479 / TASK-2212: optional second pass after `GET /listings/public?city=…` — align cards with
 * curated destination keywords (address + titles) so SEO copy and grid stay consistent.
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
