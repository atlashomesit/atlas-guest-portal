/**
 * MKT-013: Pure logic behind the Cloudflare Pages Function (functions/_middleware.ts)
 * that rewrites pre-JS <head> metadata for the marketplace host (atlastays.com).
 *
 * Rewrites <head> for:
 *   - / (Marketplace homepage)
 *   - /homestays-in-* (City landing pages)
 *   - /homes/* (Listing detail pages)
 *
 * Sets unique title/description, absolute self canonical and og:url, raster og:image
 * (never relative, never .svg), and LodgingBusiness JSON-LD for /homes/*.
 *
 * Kept HTMLRewriter-free and pure so it is trivially unit-testable with vitest.
 */
import { TtlCache } from "./ttlCache";

export interface MarketplaceListingMetaRow {
  id: number;
  title: string;
  city?: string | null;
  state?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  coverPhotoUrl?: string | null;
  photos?: string[];
  tenantSlug: string;
  tenantName?: string | null;
  pricePerNight?: number;
  maxGuests?: number;
}

export interface MarketplaceMetaValues {
  title: string;
  description: string;
  image: string;
  url: string;
  canonical: string;
  jsonLd?: Record<string, unknown> | null;
}

const MARKETPLACE_LISTINGS_TTL_MS = 5 * 60 * 1000;
const marketplaceListingsCache = new TtlCache<MarketplaceListingMetaRow[] | null>(
  MARKETPLACE_LISTINGS_TTL_MS,
);

export function isMarketplaceRewriteRoute(pathname: string): boolean {
  const p = (pathname || "").toLowerCase();
  if (p === "/" || p === "") return true;
  if (p === "/destinations" || p === "/destinations/") return true;
  if (p === "/explore" || p === "/explore/") return true;
  if (/^\/homestays-in-[a-z0-9-]+$/i.test(p)) return true;
  if (/^\/homes\//i.test(p)) return true;
  return false;
}

export function extractListingIdFromPath(pathname: string): number | null {
  const match = (pathname || "").match(/^\/homes\/(?:[^/]+\/)?(\d+)(?:\/|$)/);
  if (!match) return null;
  const id = parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
}

export function formatCityNameFromSlug(slug: string): string {
  const normalized = (slug || "").trim().toLowerCase();
  if (!normalized) return "India";
  return normalized
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toAbsoluteRasterImage(rawUrl: string | null | undefined, origin: string): string {
  const fallback = `${origin}/icons/logo512.png`;
  if (!rawUrl || typeof rawUrl !== "string") return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.toLowerCase().endsWith(".svg")) return fallback;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `${origin}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

export function buildMarketplaceMetaValues(
  pathname: string,
  search: string,
  origin: string,
  listing?: MarketplaceListingMetaRow | null,
): MarketplaceMetaValues {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const fullUrl = `${origin}${normalizedPath}${search || ""}`;

  // 1. Listing detail: /homes/*
  if (/^\/homes\//i.test(normalizedPath)) {
    if (listing) {
      const cityPart = listing.city?.trim() ? ` in ${listing.city.trim()}` : "";
      const title = `${listing.title}${cityPart} — Atlastays`;
      const description =
        (listing.description ?? "").trim() ||
        `Book ${listing.title}${cityPart} directly with the host on Atlastays. Vacation home with zero platform booking fees.`;
      const image = toAbsoluteRasterImage(
        listing.coverImageUrl || listing.coverPhotoUrl || listing.photos?.[0],
        origin,
      );

      const jsonLd: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "LodgingBusiness",
        name: listing.title,
        description,
        image,
        url: fullUrl,
        address: {
          "@type": "PostalAddress",
          addressLocality: listing.city || "India",
          addressCountry: "IN",
        },
      };

      if (typeof listing.pricePerNight === "number" && listing.pricePerNight > 0) {
        jsonLd.priceRange = `₹${listing.pricePerNight}`;
      }

      return {
        title,
        description,
        image,
        url: fullUrl,
        canonical: fullUrl,
        jsonLd,
      };
    }

    // Listing not found
    return {
      title: "Home not found — Atlastays",
      description: "This listing is no longer available on Atlastays.",
      image: `${origin}/icons/logo512.png`,
      url: fullUrl,
      canonical: fullUrl,
      jsonLd: null,
    };
  }

  // 2. City landing: /homestays-in-*
  const cityMatch = normalizedPath.match(/^\/homestays-in-([a-z0-9-]+)$/i);
  if (cityMatch) {
    const citySlug = cityMatch[1].toLowerCase();
    const cityName = formatCityNameFromSlug(citySlug);
    const title = `Homestays in ${cityName} — Book Direct with Hosts | Atlastays`;
    const description = `Discover homestays, holiday homes, and villas in ${cityName}. Book directly with local hosts with zero booking fees on Atlastays.`;
    const image = `${origin}/icons/logo512.png`;
    const canonical = `${origin}/homestays-in-${citySlug}`;

    return {
      title,
      description,
      image,
      url: canonical,
      canonical,
      jsonLd: null,
    };
  }

  // 2b. /destinations
  const lowerPath = normalizedPath.toLowerCase();
  if (lowerPath === "/destinations" || lowerPath === "/destinations/") {
    const canonical = `${origin}/destinations`;
    return {
      title: "Homestay Destinations Across India — Book Direct | Atlastays",
      description:
        "Browse curated homestay destinations across India and book directly with local hosts with zero platform booking fees on Atlastays.",
      image: `${origin}/icons/logo512.png`,
      url: canonical,
      canonical,
      jsonLd: null,
    };
  }

  // 2c. /explore
  if (lowerPath === "/explore" || lowerPath === "/explore/") {
    const canonical = `${origin}/explore`;
    return {
      title: "Explore Homestays & Villas Across India — Book Direct | Atlastays",
      description:
        "Explore handpicked homestays, holiday homes, and villas across India. Book direct with hosts and skip OTA service fees on Atlastays.",
      image: `${origin}/icons/logo512.png`,
      url: canonical,
      canonical,
      jsonLd: null,
    };
  }

  // 3. Homepage /
  return {
    title: "Atlastays — Book Homestays Directly with Hosts",
    description:
      "Browse and book vacation homes and homestays across India directly from local hosts. Zero platform booking fees on Atlastays.",
    image: `${origin}/icons/logo512.png`,
    url: `${origin}/`,
    canonical: `${origin}/`,
    jsonLd: null,
  };
}

export function clearMarketplaceListingsCache(): void {
  marketplaceListingsCache.clear();
}

/** Server clamp: MarketplaceController.NormalizePageSize turns anything above 100 into 20. */
export const MARKETPLACE_LISTINGS_PAGE_SIZE = 100;
/** Safety bound on paging (10 x 100 = 1,000 homes); the loop also stops on `total` or a short page. */
export const MARKETPLACE_LISTINGS_MAX_PAGES = 10;

/**
 * TASK-1040071: page through /marketplace/listings until `total` (or a short/empty page) so a home ranked
 * 101+ still gets its own link preview. Page 1 failing is a total failure (cached as null, fails open);
 * a later page failing returns what was gathered WITHOUT caching it, so the next request retries.
 */
export async function fetchMarketplaceListingsCached(
  apiBase: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MarketplaceListingMetaRow[]> {
  const cached = marketplaceListingsCache.get("all");
  if (cached !== undefined && cached !== null) return cached;

  const all: MarketplaceListingMetaRow[] = [];
  const seenIds = new Set<number>();
  try {
    for (let page = 1; page <= MARKETPLACE_LISTINGS_MAX_PAGES; page++) {
      let data: { items?: MarketplaceListingMetaRow[]; total?: number };
      try {
        const res = await fetchImpl(
          `${apiBase}/marketplace/listings?page=${page}&pageSize=${MARKETPLACE_LISTINGS_PAGE_SIZE}`,
          { headers: { Accept: "application/json" } },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = (await res.json()) as { items?: MarketplaceListingMetaRow[]; total?: number };
      } catch (err) {
        if (page === 1) throw err;
        return all; // partial: serve it, do not cache it
      }
      const items = Array.isArray(data.items) ? data.items : [];
      let added = 0;
      for (const item of items) {
        if (typeof item?.id !== "number" || seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        all.push(item);
        added++;
      }
      const total = typeof data.total === "number" ? data.total : null;
      if (items.length < MARKETPLACE_LISTINGS_PAGE_SIZE || added === 0) break;
      if (total !== null && all.length >= total) break;
    }
    marketplaceListingsCache.set("all", all);
    return all;
  } catch {
    marketplaceListingsCache.set("all", null);
    return [];
  }
}
