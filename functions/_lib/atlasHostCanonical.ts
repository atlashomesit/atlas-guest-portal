import { isAtlasDirectBookingHost } from "./tenantSiteMeta";

/**
 * TASK-101940: the pre-JS `<link rel="canonical">` / `og:url` value for Atlas's OWN direct-booking
 * hosts. Pure and fetch-free like `tenantSiteMeta.ts`; `functions/_middleware.ts` applies it.
 *
 * WHY. `index.html` is one static shell for every route and ships `<link rel="canonical" href="">`
 * and `<meta property="og:url" content="">`. Tenant hosts get both rewritten at the edge from
 * tenant-site-meta; Atlas first-party hosts are excluded from that rewrite, so every JS-blind client
 * (link-unfurl scrapers, non-rendering crawlers, the RA-006/AC-5 og spec) read an EMPTY canonical on
 * Atlas's own home page — even after TASK-101960 fixed the hydrated DOM.
 *
 * CONTRACT: emit exactly what the SPA sets after hydration, never a better guess. A raw canonical
 * that disagrees with the rendered one is a conflicting signal to rendering crawlers, which is worse
 * than the empty tag. `src/components/SEO.tsx` writes `canonical.href = url ?? ""` (updating the one
 * existing tag) and each route picks `url`. Only routes whose `url` is a pure function of the request
 * URL are mirrored — measured in the hydrated DOM on qa.atlashomestays.com, 2026-09-17:
 *   `/`                              → `${getPublicSiteOrigin()}/` (Home.tsx, themes/<theme>/Home.tsx,
 *                                      MarketplaceHomepage.tsx). Query string DROPPED; origin is
 *                                      VITE_PUBLIC_SITE_ORIGIN when configured, else the request's.
 *   `/homes/:propertySlug/:unitSlug` → `window.location.href` (Homepage_PropertyDetails.tsx,
 *                                      themes/heritage/PropertyDetails.tsx). Query string KEPT.
 * Every other route returns null and its tag is served untouched: most hydrate to `href=""`
 * (e.g. /search), and the fixed-path pages (/faq, /terms, city landings) and blog posts use
 * page-level constants this file deliberately does not copy. `atlasHostCanonical.test.ts` pins the
 * SPA source both formulas were read from, so a change there fails loudly instead of diverging.
 */

/* eslint-disable atlas-brand/no-atlas-string-leak -- first-party Atlas host allowlist for the pre-JS canonical; never rendered to guests */
/**
 * Atlas direct-booking hosts that serve the SAME `atlas` site as `atlashomestays.com` with HTTP 200
 * and no redirect (measured 2026-09-17: each returns 200 for `/`, and `http://www.atlashomestays.com/`
 * 301s to its own https URL, not to the apex). A self-referential canonical on each would advertise
 * duplicate copies of one site as independent canonicals, so their tag is left exactly as served —
 * the pre-existing state. A zone-level 301 to the apex is the durable fix and makes this set moot.
 */
const ATLAS_DUPLICATE_ALIAS_HOSTS = new Set<string>([
  "www.atlashomestays.com",
  "atlashomes.in",
  "www.atlashomes.in",
]);
/* eslint-enable atlas-brand/no-atlas-string-leak */

/**
 * TASK-102420: duplicate-alias → apex 301 target. `www.atlashomestays.com` serves the
 * apex site byte-identical with HTTP 200 (measured 2026-09-17), so crawlers index two
 * copies; `atlashomes.in` / `www.atlashomes.in` are deliberately NOT mapped here — that
 * is a branding decision (different domain), not a www-prefix cleanup, and needs a
 * founder call before any redirect ships.
 */
const APEX_HOST = "atlashomestays.com";

/**
 * Returns the 301 target URL when `requestUrl` arrived on a duplicate alias host that
 * should canonically resolve to the apex, else null. Pure (no fetch), so unit-tested.
 * Callers must only invoke this for DIRECT traffic — behind the tenant-subdomain-router
 * Worker the URL host is `*.pages.dev` and redirecting would break the proxy flow.
 */
export function apexRedirectForHost(requestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.hostname.toLowerCase() !== `www.${APEX_HOST}`) return null;
  url.hostname = APEX_HOST;
  url.protocol = "https:";
  return url.toString();
}

/** React Router's `/homes/:propertySlug/:unitSlug` (case-insensitive, optional trailing slash). */
const PROPERTY_DETAIL_PATH_RE = /^\/homes\/[^/]+\/[^/]+\/?$/i;

/**
 * True when `hostname` gets the pre-JS canonical: an Atlas direct-booking host that is not a
 * duplicate alias. A subset of `isAtlasDirectBookingHost`, so a tenant host can never qualify.
 */
export function isAtlasSelfCanonicalHost(hostname: string | null | undefined): boolean {
  const host = (hostname ?? "").trim().toLowerCase();
  return isAtlasDirectBookingHost(host) && !ATLAS_DUPLICATE_ALIAS_HOSTS.has(host);
}

/** Edge twin of `src/config/siteOrigin.ts` `getPublicSiteOrigin()`, with the request as `window`. */
export function resolveSiteOrigin(configuredSiteOrigin: string | null | undefined, requestOrigin: string): string {
  const trimmed = configuredSiteOrigin?.trim();
  if (trimmed && /^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }
  return requestOrigin;
}

/**
 * The canonical SEO.tsx sets after hydration for `requestUrl`, or null when that route has no
 * URL-derived canonical (the caller then leaves the served tag untouched).
 */
export function buildAtlasHostCanonical(
  requestUrl: string,
  configuredSiteOrigin?: string | null,
): string | null {
  const url = new URL(requestUrl);

  if (url.pathname === "/") {
    return `${resolveSiteOrigin(configuredSiteOrigin, url.origin)}/`;
  }

  if (PROPERTY_DETAIL_PATH_RE.test(url.pathname)) {
    url.hash = ""; // never sent by a client; kept out defensively so the value equals location.href
    return url.href;
  }

  return null;
}
