import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import SEO from "@/components/SEO";
import { buildApiUrl } from "@/api/client";
import { getTenantContext } from "@/tenant/tenantContext";
import { getTenantOverrides, shouldHideAtlasBranding } from "@/tenant/tenantOverrides";
import { isAtlastaysMarketplaceSurface, isMarketplaceMode } from "@/tenant/tenantResolver";
import { marketplaceListingMatchesCityKeywords, type MarketplaceCityMatchCandidate } from "@/utils/cityListingFilter";
import { CITY_DIRECTORY } from "@/content/cities/cityDirectory";
import type { CityLandingSlug } from "@/content/cities/cityLandingSlugs";

import coorgContent from "@/content/cities/coorg.json";
import goaContent from "@/content/cities/goa.json";
import hyderabadContent from "@/content/cities/hyderabad.json";
import manaliContent from "@/content/cities/manali.json";
import bengaluruContent from "@/content/cities/bengaluru.json";
import gurugramContent from "@/content/cities/gurugram.json";
import nashikContent from "@/content/cities/nashik.json";
import guwahatiContent from "@/content/cities/guwahati.json";
import jalandharContent from "@/content/cities/jalandhar.json";

/** The same keyword lists each city guide uses to decide which listings belong to it. */
const CITY_KEYWORDS: Record<CityLandingSlug, readonly string[]> = {
  goa: goaContent.listingKeywords,
  coorg: coorgContent.listingKeywords,
  hyderabad: hyderabadContent.listingKeywords,
  manali: manaliContent.listingKeywords,
  bengaluru: bengaluruContent.listingKeywords,
  gurugram: gurugramContent.listingKeywords,
  nashik: nashikContent.listingKeywords,
  guwahati: guwahatiContent.listingKeywords,
  jalandhar: jalandharContent.listingKeywords,
};

const MARKETPLACE_PAGE_SIZE = 50;
/** Hard stop so a misbehaving `total` can never loop: 20 pages x 50 = 1,000 listings. */
const MAX_PAGES = 20;

type MarketplaceListingsPage = { items?: MarketplaceCityMatchCandidate[]; total?: number };

/** MKT-034: pages the existing cross-tenant `GET /marketplace/listings` (no new endpoint), as CityLandingPage does. */
async function fetchMarketplaceListings(signal: AbortSignal): Promise<MarketplaceCityMatchCandidate[]> {
  const out: MarketplaceCityMatchCandidate[] = [];
  let total = Infinity;
  for (let page = 1; page <= MAX_PAGES && out.length < total; page += 1) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(MARKETPLACE_PAGE_SIZE) });
    const res = await fetch(buildApiUrl(`/marketplace/listings?${params.toString()}`), { signal });
    if (!res.ok) throw new Error(`marketplace listings ${res.status}`);
    const data = (await res.json()) as MarketplaceListingsPage;
    const items = Array.isArray(data.items) ? data.items : [];
    out.push(...items);
    total = typeof data.total === "number" ? data.total : out.length;
    if (items.length === 0) break;
  }
  return out;
}

/** Stays per city guide, counted with the guide's own keyword rule. A city with none is simply absent from the map. */
export function countStaysByCity(rows: readonly MarketplaceCityMatchCandidate[]): Partial<Record<CityLandingSlug, number>> {
  const counts: Partial<Record<CityLandingSlug, number>> = {};
  for (const city of CITY_DIRECTORY) {
    const n = rows.filter((row) => marketplaceListingMatchesCityKeywords(row, CITY_KEYWORDS[city.slug])).length;
    if (n > 0) counts[city.slug] = n;
  }
  return counts;
}

const stayCountLabel = (n: number): string => `${n} ${n === 1 ? "stay" : "stays"}`;

function DestinationsDirectory() {
  const onMarketplace = isMarketplaceMode() && isAtlastaysMarketplaceSurface();
  const [counts, setCounts] = useState<Partial<Record<CityLandingSlug, number>>>({});

  useEffect(() => {
    // Counts come from the cross-tenant marketplace feed, so only the marketplace surface asks for them.
    if (!onMarketplace) return;
    const ac = new AbortController();
    fetchMarketplaceListings(ac.signal)
      .then((rows) => {
        if (!ac.signal.aborted) setCounts(countStaysByCity(rows));
      })
      .catch(() => {
        // A failed load leaves the cards without counts; the links still work.
      });
    return () => ac.abort();
  }, [onMarketplace]);

  const cities = useMemo(() => CITY_DIRECTORY, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 text-text-primary sm:px-6" data-testid="destinations-page">
      <SEO
        title="Explore destinations | Homestays across India"
        description="Browse homestay destinations across India: Goa, Coorg, Manali, Hyderabad, Bengaluru, Gurugram, Nashik, Guwahati and Jalandhar. Book direct with the host."
        url="/destinations"
      />
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Destinations</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Explore destinations</h1>
        <p className="mt-3 max-w-3xl text-sm text-text-muted">
          Pick a city to see its homestay guide and the stays you can book direct with the host.
        </p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
        {cities.map((city) => {
          const count = counts[city.slug];
          return (
            <li key={city.slug}>
              <Link
                to={city.path}
                data-testid={`destination-card-${city.slug}`}
                className="flex h-full flex-col gap-1 rounded-2xl border border-border bg-bg-surface p-5 shadow-sm transition-all hover:border-border-subtle hover:shadow-md"
              >
                <span className="text-lg font-semibold">{city.name}</span>
                <span className="text-sm text-text-muted">{city.tagline}</span>
                {count ? (
                  <span className="mt-2 text-sm font-medium text-emerald-700" data-testid={`destination-count-${city.slug}`}>
                    {stayCountLabel(count)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * MKT-034: `/destinations` (alias `/explore`), the city directory. Like the `/homestays-in-{city}` guides it links to, it is
 * Atlas marketplace content: a white-label tenant domain is sent home rather than shown Atlas city guides.
 */
export default function DestinationsPage() {
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  if (shouldHideAtlasBranding(tenant, overrides)) {
    return <Navigate to="/" replace />;
  }
  return <DestinationsDirectory />;
}
