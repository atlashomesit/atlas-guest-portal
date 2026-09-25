import { resolveTenantSlugFromDomain } from "./_lib/tenantSlug";
import { isAtlasDirectBookingHost, isMarketplaceHost } from "./_lib/tenantSiteMeta";
import { isNoindexHost } from "./_lib/noindexHosts";
import { textMatchesCityKeywords } from "./_lib/cityKeywordMatch";
import goaCityContent from "../src/content/cities/goa.json";
import coorgCityContent from "../src/content/cities/coorg.json";
import hyderabadCityContent from "../src/content/cities/hyderabad.json";
import manaliCityContent from "../src/content/cities/manali.json";

interface Env {
  ATLAS_API_BASE_URL?: string;
  ATLAS_TENANT_KEY?: string;
  /** TASK-7207: must match Worker `ATLAS_WORKER_PROXY_SECRET` to trust X-Forwarded-Host. */
  ATLAS_WORKER_PROXY_SECRET?: string;
}

// TASK-4414: city landing pages for SEO acquisition (Atlas marketplace surfaces only — TASK-7194)
const CITY_LANDING_SLUGS = ["goa", "coorg", "hyderabad", "manali"] as const;

/**
 * MKT-006: keyword lists a marketplace listing must match to count as supply for a given city
 * landing page — imported directly from `src/content/cities/<slug>.json` (the same
 * `listingKeywords` MKT-004's `CityLandingPage.tsx` matches against) rather than duplicated as
 * literals here. Atlas-brand-specific neighbourhood terms (KPHB, Kukatpally, Jubilee Hills) are
 * banned as raw string literals in `.ts`/`.tsx` source by the `no-atlas-string-leak` ESLint rule
 * (RA-006) precisely because this bundle ships to every tenant; importing the JSON (exempt from
 * that rule, and the actual source of truth) avoids reintroducing the leak risk while staying in
 * sync with MKT-004 automatically.
 */
const CITY_LANDING_KEYWORDS: Record<(typeof CITY_LANDING_SLUGS)[number], string[]> = {
  goa: goaCityContent.listingKeywords,
  coorg: coorgCityContent.listingKeywords,
  hyderabad: hyderabadCityContent.listingKeywords,
  manali: manaliCityContent.listingKeywords,
};

const ATLAS_CITY_PATHS = CITY_LANDING_SLUGS.map((slug) => `/homestays-in-${slug}`);

/**
 * MKT-006: cross-tenant `GET /marketplace/listings` row shape this function needs
 * (`MarketplaceListingDto`).
 */
export type SitemapMarketplaceListingRow = {
  id: number;
  tenantSlug: string;
  title: string;
  city?: string | null;
  slug?: string;
};

/** MKT-006: which `CITY_LANDING_SLUGS` entries have at least one matching marketplace listing. */
export function citySlugsWithMarketplaceSupply(
  listings: SitemapMarketplaceListingRow[],
): Array<(typeof CITY_LANDING_SLUGS)[number]> {
  return CITY_LANDING_SLUGS.filter((slug) =>
    listings.some((l) => textMatchesCityKeywords({ city: l.city, title: l.title }, CITY_LANDING_KEYWORDS[slug])),
  );
}

/**
 * MKT-006: one paged pass over `GET /marketplace/listings`, no per-listing calls — mirrors
 * `CityLandingPage.tsx`'s `fetchAllMarketplaceListings` (MKT-004).
 */
export async function fetchAllMarketplaceListings(
  apiBase: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SitemapMarketplaceListingRow[]> {
  const out: SitemapMarketplaceListingRow[] = [];
  const pageSize = 50;
  let page = 1;
  let total = Infinity;
  while (out.length < total) {
    const res = await fetchImpl(
      `${apiBase}/marketplace/listings?page=${page}&pageSize=${pageSize}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) break;
    const data = (await res.json()) as { items?: SitemapMarketplaceListingRow[]; total?: number };
    const items = Array.isArray(data.items) ? data.items : [];
    out.push(...items);
    total = typeof data.total === "number" ? data.total : out.length;
    if (items.length === 0) break;
    page += 1;
  }
  return out;
}

/**
 * MKT-006: canonical URL path for a marketplace (cross-tenant) listing — the SAME shape
 * `MarketplaceHomepage.tsx`'s `marketplaceListingPath` links to and the listing detail page
 * declares as its own canonical (`?tenant=` tells the detail page which tenant's listing to
 * resolve on the shared marketplace host).
 */
export function marketplaceListingPath(
  listing: SitemapMarketplaceListingRow,
  opts: { allowAtlasHomesFallback: boolean },
): string {
  const propertySlug = listingPathSlug(
    { id: listing.id, slug: listing.slug, propertyName: listing.title },
    opts,
  );
  return `/homes/${propertySlug}/${listing.id}?tenant=${encodeURIComponent(listing.tenantSlug)}`;
}

const SHARED_CORE_PATHS = [
  "/",
  "/amenities",
  "/location",
  "/gallery",
  "/offers",
  "/blog",
  "/blog/guest-guides",
  "/blog/hospitality-tech",
  "/policies",
  "/contact",
  "/about",
  "/faq",
  "/terms",
];

const CORE_PATHS = [...SHARED_CORE_PATHS, ...ATLAS_CITY_PATHS];

/** Paths every tenant sitemap includes (no Atlas SEO city guides). */
export const SHARED_SITEMAP_PATHS = SHARED_CORE_PATHS;

/** Full marketplace sitemap paths (includes Atlas city landing pages). */
export const SITEMAP_PATHS = CORE_PATHS;

export function buildSitemapXml(baseUrl: string, paths: string[]): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  const urlEntries = paths.map((path) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `  <url><loc>${normalizedBase}${normalizedPath}</loc></url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urlEntries,
    "</urlset>",
  ].join("\n");
}

function slugify(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * TASK-7430: listing path slug for sitemap — never invent "atlas-homes" for a non-Atlas host.
 * Prefer API-provided slug fields, then property/listing name, then home-{id}.
 */
/**
 * TASK-102424: sitemap must list only published, active, public-facing pages.
 * The generator used to emit every `/listings/public` row with a numeric id, so
 * deleted/unpublished drafts leaked in as 404 crawl errors. Drop rows carrying an
 * explicit unpublished/inactive/deleted signal; rows without any status fields
 * (the API's normal published shape) still pass.
 */
export function isSitemapEligibleListing(raw: unknown): boolean {
  const l = (raw ?? {}) as Record<string, unknown>;
  if (l.isPublished === false || l.isActive === false || l.isDeleted === true) return false;
  const status = String(l.status ?? l.state ?? '').trim().toLowerCase();
  if (status && ['draft', 'unpublished', 'inactive', 'deleted', 'archived'].includes(status)) {
    return false;
  }
  return true;
}

export function listingPathSlug(
  listing: {
    id?: unknown;
    propertySlug?: unknown;
    property_slug?: unknown;
    slug?: unknown;
    propertyName?: unknown;
    name?: unknown;
  },
  opts: { allowAtlasHomesFallback: boolean },
): string {
  const id = Number(listing?.id);
  const idFallback = Number.isFinite(id) && id > 0 ? `home-${id}` : "home";
  const fromApi =
    slugify(String(listing?.propertySlug ?? "")) ||
    slugify(String(listing?.property_slug ?? "")) ||
    slugify(String(listing?.slug ?? "")) ||
    slugify(String(listing?.propertyName ?? listing?.name ?? ""));
  if (fromApi) {
    // Guard: do not emit marketplace "atlas-homes" on a white-label / non-Atlas host.
    if (!opts.allowAtlasHomesFallback && fromApi === "atlas-homes") {
      return idFallback;
    }
    return fromApi;
  }
  if (opts.allowAtlasHomesFallback) {
    return "atlas-homes";
  }
  return idFallback;
}

/** Resolve which X-Tenant-Slug to use for the listings/public fetch (Host-first). */
export async function resolveSitemapTenantSlug(
  host: string,
  apiBase: string,
  envTenantKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ tenantSlug: string | null; allowAtlasHomesFallback: boolean }> {
  const hostname = (host ?? "").trim().toLowerCase();
  const isAtlasHost =
    isMarketplaceHost(hostname) ||
    isAtlasDirectBookingHost(hostname) ||
    hostname.endsWith(".localhost");

  if (isMarketplaceHost(hostname)) {
    return { tenantSlug: null, allowAtlasHomesFallback: true };
  }
  if (isAtlasHost) {
    return { tenantSlug: envTenantKey || "atlas", allowAtlasHomesFallback: true };
  }

  // Tenant subdomain / custom domain — Host-derived slug via from-domain (never rely only on ATLAS_TENANT_KEY).
  const fromDomain = apiBase
    ? await resolveTenantSlugFromDomain(apiBase, hostname, fetchImpl)
    : null;
  const tenantSlug = fromDomain || envTenantKey || null;
  // Never allow atlas-homes paths for a resolved non-atlas tenant (or unknown host).
  const allowAtlasHomesFallback = tenantSlug === "atlas";
  return { tenantSlug, allowAtlasHomesFallback };
}

export const onRequestGet = async ({ request, env }: { request: Request; env?: Env }) => {
  const url = new URL(request.url);
  const origin = url.origin;
  const runtimeEnv = env ?? {};
  const apiBase = (runtimeEnv.ATLAS_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const envTenantKey = (runtimeEnv.ATLAS_TENANT_KEY ?? "").trim();

  // TASK-7170 + TASK-7207: trust X-Forwarded-Host only with Worker proxy provenance.
  const isWorkerProxiedOrigin = url.hostname.toLowerCase().endsWith(".pages.dev");
  const configuredSecret = (runtimeEnv.ATLAS_WORKER_PROXY_SECRET ?? "").trim();
  const presentedSecret = (request.headers.get("x-atlas-worker-proxy") ?? "").trim();
  const proxyProvenanceOk =
    isWorkerProxiedOrigin &&
    configuredSecret.length > 0 &&
    presentedSecret.length > 0 &&
    presentedSecret === configuredSecret;
  const forwardedHost = proxyProvenanceOk
    ? (request.headers.get("x-forwarded-host") ?? "").trim().toLowerCase()
    : "";
  const host = forwardedHost || url.hostname.toLowerCase();

  const { tenantSlug, allowAtlasHomesFallback } = await resolveSitemapTenantSlug(
    host,
    apiBase,
    envTenantKey,
  );

  const isAtlasHost =
    isMarketplaceHost(host) ||
    isAtlasDirectBookingHost(host) ||
    host.endsWith(".localhost");

  const listingPaths: string[] = [];
  // MKT-006: resolveSitemapTenantSlug returns tenantSlug: null for the marketplace host, which
  // previously skipped listing enumeration entirely (0 of 27 cross-tenant listings ever reached
  // this sitemap). The marketplace has no single tenant to scope by — enumerate every listing via
  // the cross-tenant GET /marketplace/listings instead, one paged pass, no per-listing calls.
  let cityPaths = ATLAS_CITY_PATHS;
  if (isMarketplaceHost(host)) {
    if (apiBase) {
      try {
        const rows = await fetchAllMarketplaceListings(apiBase, fetch);
        for (const row of rows) {
          if (!Number.isFinite(row.id) || row.id <= 0 || !row.tenantSlug) continue;
          if (!isSitemapEligibleListing(row)) continue;
          listingPaths.push(marketplaceListingPath(row, { allowAtlasHomesFallback: true }));
        }
        // A homestays-in-<city> URL is offered only when the marketplace actually has supply
        // there — otherwise it is a guaranteed-empty page handed to a crawler (Coorg/Manali today).
        const suppliedSlugs = citySlugsWithMarketplaceSupply(rows);
        cityPaths = suppliedSlugs.map((slug) => `/homestays-in-${slug}`);
      } catch {
        // sitemap still works with core paths only; no city landing pages advertised either,
        // since supply is unknown rather than confirmed zero.
        cityPaths = [];
      }
    } else {
      cityPaths = [];
    }
  }

  // TASK-7194: omit /homestays-in-* from white-label tenant sitemaps.
  const corePaths = isMarketplaceHost(host)
    ? [...SHARED_CORE_PATHS, ...cityPaths]
    : isAtlasHost
      ? CORE_PATHS
      : SHARED_CORE_PATHS;

  // An internal-tenant demo host publishes core paths only — never its seeded listings. Enumerating
  // them here would hand every non-JS crawler a full index of fabricated Atlas inventory and prices,
  // which is precisely what the JS-only noindex meta tag (TASK-4386) cannot prevent.
  if (!isMarketplaceHost(host) && apiBase && tenantSlug && !isNoindexHost(host)) {
    try {
      const res = await fetch(`${apiBase}/listings/public`, {
        headers: {
          Accept: "application/json",
          "X-Tenant-Slug": tenantSlug,
        },
      });
      if (res.ok) {
        const list = (await res.json()) as unknown[];
        if (Array.isArray(list)) {
          for (const raw of list) {
            const l = raw as Record<string, unknown>;
            const id = Number(l?.id);
            if (!Number.isFinite(id) || id <= 0) continue;
            if (!isSitemapEligibleListing(l)) continue;
            const propertySlug = listingPathSlug(l, { allowAtlasHomesFallback });
            listingPaths.push(`/homes/${propertySlug}/${id}`);
          }
        }
      }
    } catch {
      // sitemap still works with core paths only
    }
  }

  const paths = Array.from(new Set([...corePaths, ...listingPaths]));
  const sitemapXml = buildSitemapXml(origin, paths);

  return new Response(sitemapXml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
