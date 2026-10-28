import { Link } from "react-router-dom";

import { CITY_DIRECTORY } from "@/content/cities/cityDirectory";
import { sanitizeGuestImageUrl } from "@/utils/guestImageUrl";

/** The slice of a marketplace card this strip reads, to borrow a real photo for a city's chip. */
export type DestinationStripListing = {
  city?: string | null;
  title?: string | null;
  coverImageUrl?: string | null;
};

type ExploreDestinationsStripProps = {
  /** Listings already loaded on the page. Only used for thumbnails; no counts, no extra request. */
  listings?: readonly DestinationStripListing[];
};

/** Whole-word match of the city's name in the listing's city or title, so "Goa" never matches "Goat Farm Stay". */
function listingIsInCity(listing: DestinationStripListing, cityName: string): boolean {
  const haystack = `${listing.city ?? ""} ${listing.title ?? ""}`;
  const word = new RegExp(`(^|[^a-z0-9])${cityName.toLowerCase()}($|[^a-z0-9])`, "i");
  return word.test(haystack);
}

/**
 * MKT-034: "Explore Top Destinations" quick-filter strip under the marketplace hero. One chip per city guide, linking to
 * `/homestays-in-{slug}`. A chip shows a thumbnail only when a listing already loaded on the page is in that city (by its
 * city or title); otherwise it shows a pin. No stay counts here: the page has loaded one page of listings, so a count
 * would under-report. The full directory with counts is `/destinations`.
 */
export default function ExploreDestinationsStrip({ listings = [] }: ExploreDestinationsStripProps) {
  return (
    <nav aria-labelledby="marketplace-destinations-heading" className="mt-6" data-testid="marketplace-destinations-strip">
      <div className="flex items-baseline justify-between gap-3">
        {/* A labelled nav landmark, not an <h2>: the card grid below owns the page's level-2 headings (one per listing). */}
        <p id="marketplace-destinations-heading" className="text-base font-semibold text-text-primary">
          Explore Top Destinations
        </p>
        <Link to="/destinations" className="text-sm font-medium text-text-body underline hover:text-text-primary" data-testid="marketplace-destinations-all">
          All destinations
        </Link>
      </div>
      <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" role="list">
        {CITY_DIRECTORY.map((city) => {
          const withPhoto = listings.find(
            (l) => Boolean(sanitizeGuestImageUrl(l.coverImageUrl)) && listingIsInCity(l, city.name),
          );
          const thumb = sanitizeGuestImageUrl(withPhoto?.coverImageUrl);
          return (
            <li key={city.slug} className="shrink-0">
              <Link
                to={city.path}
                data-testid={`marketplace-destination-chip-${city.slug}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-bg-surface py-1 pl-1 pr-4 text-sm font-medium text-text-primary shadow-sm transition-colors hover:border-border-subtle hover:bg-bg-muted"
              >
                {thumb ? (
                  <img src={thumb} alt="" loading="lazy" className="h-8 w-8 rounded-full object-cover" data-testid="marketplace-destination-thumb" />
                ) : (
                  <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-muted text-base">
                    📍
                  </span>
                )}
                {city.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
