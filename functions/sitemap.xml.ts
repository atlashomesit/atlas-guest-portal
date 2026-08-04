import { resolveTenantSlugFromDomain } from "./_lib/tenantSlug";
import { isAtlasDirectBookingHost, isMarketplaceHost } from "./_lib/tenantSiteMeta";

interface Env {
  ATLAS_API_BASE_URL?: string;
  ATLAS_TENANT_KEY?: string;
}

// TASK-4414: city landing pages for SEO acquisition
const CITY_LANDING_SLUGS = ["goa", "coorg", "hyderabad", "manali"] as const;

const CORE_PATHS = [
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
  // City landing pages (TASK-4414)
  ...CITY_LANDING_SLUGS.map((slug) => `/homestays-in-${slug}`),
];

// Backward-compatible export used by tests; includes static (always-on) sitemap paths.
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

  // TASK-7170: through tenant-subdomain-router the public host is in X-Forwarded-Host on .pages.dev.
  const isWorkerProxiedOrigin = url.hostname.toLowerCase().endsWith(".pages.dev");
  const forwardedHost = isWorkerProxiedOrigin
    ? (request.headers.get("x-forwarded-host") ?? "").trim().toLowerCase()
    : "";
  const host = forwardedHost || url.hostname.toLowerCase();

  const { tenantSlug, allowAtlasHomesFallback } = await resolveSitemapTenantSlug(
    host,
    apiBase,
    envTenantKey,
  );

  const listingPaths: string[] = [];
  if (apiBase && tenantSlug) {
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
            const propertySlug = listingPathSlug(l, { allowAtlasHomesFallback });
            listingPaths.push(`/homes/${propertySlug}/${id}`);
          }
        }
      }
    } catch {
      // sitemap still works with core paths only
    }
  }

  const paths = Array.from(new Set([...CORE_PATHS, ...listingPaths]));
  const sitemapXml = buildSitemapXml(origin, paths);

  return new Response(sitemapXml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
