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
        `Book ${listing.title}${cityPart} directly with the owner on Atlastays. Verified vacation home, instant confirmation, zero platform fees.`;
      const image = toAbsoluteRasterImage(
        listing.coverPhotoUrl || listing.photos?.[0],
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
    const title = `Homestays in ${cityName} — Book Direct with Owners | Atlastays`;
    const description = `Discover verified homestays, holiday homes, and villas in ${cityName}. Book directly with local owners with zero booking fees on Atlastays.`;
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

  // 3. Homepage /
  return {
    title: "Atlastays — Book Homestays Directly with Verified Owners",
    description:
      "Browse and book verified vacation homes and homestays across India directly from local owners. Zero platform booking fees on Atlastays.",
    image: `${origin}/icons/logo512.png`,
    url: `${origin}/`,
    canonical: `${origin}/`,
    jsonLd: null,
  };
}

export function clearMarketplaceListingsCache(): void {
  marketplaceListingsCache.clear();
}

export async function fetchMarketplaceListingsCached(
  apiBase: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MarketplaceListingMetaRow[]> {
  const cached = marketplaceListingsCache.get("all");
  if (cached !== undefined && cached !== null) return cached;


  try {
    const res = await fetchImpl(`${apiBase}/marketplace/listings?page=1&pageSize=100`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      marketplaceListingsCache.set("all", null);
      return [];
    }
    const data = (await res.json()) as { items?: MarketplaceListingMetaRow[] };
    const items = Array.isArray(data.items) ? data.items : [];
    marketplaceListingsCache.set("all", items);
    return items;
  } catch {
    marketplaceListingsCache.set("all", null);
    return [];
  }
}
