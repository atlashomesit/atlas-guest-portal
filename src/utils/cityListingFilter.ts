import type { PublicListing } from "@/api/listingClient";
import { textMatchesCityKeywords } from "../../functions/_lib/cityKeywordMatch";

/**
 * TASK-1479: `GET /listings/public` does not yet support `?city=` — match listings client-side
 * using address and titles against curated keywords for each destination.
 */
export function listingMatchesCityKeywords(
  listing: PublicListing,
  keywords: readonly string[],
): boolean {
  return textMatchesCityKeywords(
    {
      address: listing.propertyAddress,
      title: [listing.propertyName, listing.name].filter(Boolean).join(" "),
    },
    keywords,
  );
}

/**
 * MKT-004: cross-tenant `GET /marketplace/listings` row shape (`MarketplaceListingDto`) — no
 * per-listing address field, only `city` and `title`. Same matching rule, applied to what this
 * DTO actually returns.
 */
export type MarketplaceCityMatchCandidate = {
  city?: string | null;
  title?: string | null;
};

export function marketplaceListingMatchesCityKeywords(
  item: MarketplaceCityMatchCandidate,
  keywords: readonly string[],
): boolean {
  return textMatchesCityKeywords({ city: item.city, title: item.title }, keywords);
}
