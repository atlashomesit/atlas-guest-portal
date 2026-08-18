/**
 * TASK-4905 / ADR-0018 (2026-07-16 amendment): pure, environment-independent logic behind the
 * Cloudflare Pages Function (`functions/_middleware.ts`) that rewrites pre-JS OG/Twitter/canonical
 * `<meta>` tags for WhatsApp/social link-unfurling crawlers. Kept HTMLRewriter-free and
 * fetch-free on purpose so it is trivially unit-testable with `vitest` (no Cloudflare Workers
 * runtime required) — see `tests/tenantSiteMeta.test.ts`.
 */

/** Shape of `GET /api/public/tenant-site-meta`'s 200 response (atlas-api `TenantSiteMetaDto`). */
export interface TenantSiteMeta {
  tenantSlug: string;
  propertyName: string;
  description?: string | null;
  photoUrl?: string | null;
  canonicalUrl: string;
}

/**
 * ALL Atlas first-party hosts are short-circuited out of the rewrite and keep their existing
 * static/runtime OG tags (ADR-0018 2026-07-16 amendment, corrected 2026-07-17). Two families,
 * mirroring `TenantsController.cs`'s `_marketplaceDomains` / `_atlasDirectBookingDomains` — this
 * Pages Function cannot import server-side C#, so both sets are duplicated here deliberately (the
 * same accepted-duplication pattern as `ADR-0081 D2`'s canonical-list convention). Keep both lists
 * in sync with `TenantsController.cs` whenever either changes.
 */
const MARKETPLACE_HOSTS = new Set<string>([
  "atlastays.com",
  "www.atlastays.com",
  "dev.atlastays.com",
]);

/* eslint-disable atlas-brand/no-atlas-string-leak -- canonical first-party Atlas host allowlist for OG rewrite short-circuit; never rendered to guests */
const ATLAS_DIRECT_BOOKING_HOSTS = new Set<string>([
  "atlashomestays.com",
  "www.atlashomestays.com",
  "atlashomes.in",
  "www.atlashomes.in",
  "dev.atlashomestays.com",
  // TASK-7705: qa release-train guest surface. Without this, qa.atlashomestays.com falls to the
  // tenant-subdomain branch below, which round-trips resolveTenantSlugFromDomain (always a miss —
  // no CustomDomain row) before falling back to ATLAS_TENANT_KEY. Listing it here makes QA resolve
  // the same direct way dev.atlashomestays.com already does, with no extra API call per request.
  "qa.atlashomestays.com",
  "localhost",
  "127.0.0.1",
]);
/* eslint-enable atlas-brand/no-atlas-string-leak */

/** True for the marketplace apex hosts (`atlastays.com` family). */
export function isMarketplaceHost(hostname: string | null | undefined): boolean {
  return MARKETPLACE_HOSTS.has((hostname ?? "").trim().toLowerCase());
}

/** True for Atlas's own direct-booking hosts (`atlashomestays.com` family + loopback). */
export function isAtlasDirectBookingHost(hostname: string | null | undefined): boolean {
  return ATLAS_DIRECT_BOOKING_HOSTS.has((hostname ?? "").trim().toLowerCase());
}

/**
 * True when `hostname` should get the pre-JS OG rewrite (a tenant subdomain/custom domain).
 * False for every Atlas first-party host (marketplace apex + Atlas direct-booking domains) —
 * those keep their existing static/runtime tags untouched, and the caller should skip the API
 * round-trip entirely for them.
 */
export function isRewriteEligibleHost(hostname: string | null | undefined): boolean {
  const host = (hostname ?? "").trim().toLowerCase();
  if (!host) return false;
  if (isMarketplaceHost(host)) return false;
  if (isAtlasDirectBookingHost(host)) return false;
  return true;
}

/**
 * TASK-7468 done-when #5: this helper runs only for rewrite-eligible *tenant* hosts
 * (see {@link isRewriteEligibleHost}). Never fall back to Atlas `/og-image.svg` here —
 * that asset is an Atlas brand mark and would leak onto white-label / Neutral share cards.
 * Empty `image` means the middleware removes og/twitter image tags rather than substituting
 * a platform asset.
 */
export const NEUTRAL_NO_OG_IMAGE = "";

export interface MetaRewriteValues {
  title: string;
  description: string;
  /** Absolute or relative image URL; empty string = omit og/twitter image (no Atlas fallback). */
  image: string;
  url: string;
  canonical: string;
}

/**
 * Computes the final tag values to inject, given a (possibly malformed/partial) tenant-site-meta
 * payload. Defensive against a null/empty/whitespace-only `propertyName`, `description`, or
 * `photoUrl` — the API contract requires `propertyName`/`canonicalUrl` to always be non-empty, but
 * this function never trusts that and always produces a usable value, so a malformed upstream
 * response degrades gracefully instead of injecting blank/broken meta tags.
 *
 * TASK-7430: do NOT collapse every page's canonical/og:url to the site root. The API's
 * `canonicalUrl` is the tenant origin (often `/`); for non-root request paths, preserve the
 * request pathname (+ search) on that origin so listing/detail pages keep a path-correct
 * canonical.
 */
export function buildMetaRewriteValues(meta: TenantSiteMeta, requestUrl: string): MetaRewriteValues {
  const propertyName = (meta.propertyName ?? "").trim() || (meta.tenantSlug ?? "").trim() || "Atlastays";

  const description =
    (meta.description ?? "").trim() ||
    `Book ${propertyName} directly. Verified property, zero booking fees, instant confirmation.`;

  // TASK-7468 #5: white-label/Neutral hosts must not inherit Atlas /og-image.svg.
  const image = (meta.photoUrl ?? "").trim() || NEUTRAL_NO_OG_IMAGE;

  const metaCanonical = (meta.canonicalUrl ?? "").trim();
  let canonical = metaCanonical || requestUrl;

  try {
    const req = new URL(requestUrl);
    const path = req.pathname || "/";
    if (path !== "/") {
      const origin = metaCanonical ? new URL(metaCanonical).origin : req.origin;
      canonical = `${origin}${path}${req.search}`;
    }
  } catch {
    // keep metaCanonical / requestUrl fallback above
  }

  return {
    title: propertyName,
    description,
    image,
    url: canonical,
    canonical,
  };
}
