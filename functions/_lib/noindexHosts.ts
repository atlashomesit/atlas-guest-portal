/**
 * Hosts that must never be indexed, even in production.
 *
 * The internal-tenant showcase site (`atlas-showcase`) carries fabricated Atlas-branded inventory and
 * prices for sales demos. Published, it would compete with the real booking funnel in search results and
 * misrepresent availability to guests who found it organically.
 *
 * This exists because the in-app protection is JS-only: TASK-4386 injects `noindex, nofollow` from a
 * `useEffect` (`src/components/InternalTenantRobotsMeta.tsx`), so it never reaches a non-JS crawler —
 * and `robots.txt` / `sitemap.xml` are exactly the two surfaces such a crawler reads first. Without this,
 * the demo host would actively advertise every seeded listing via its own sitemap.
 *
 * Matched on HOST, deliberately, rather than on an `isInternal` lookup: Pages Functions have no
 * isInternal signal (`TenantSiteMetaDto` does not expose it, and adding a blocking API call to
 * robots.txt would be worse), and a duplicated host set is the accepted convention already documented
 * in `_lib/tenantSiteMeta.ts`. Keep this in sync when an internal tenant gains or loses a host.
 */
/* eslint-disable atlas-brand/no-atlas-string-leak -- internal-tenant host allowlist for crawler suppression; never rendered to guests */
export const NOINDEX_HOSTS = new Set<string>(["atlas-showcase.atlastays.com"]);
/* eslint-enable atlas-brand/no-atlas-string-leak */

/** True when this host must be kept out of search indexes regardless of environment. */
export function isNoindexHost(hostname: string | null | undefined): boolean {
  return NOINDEX_HOSTS.has((hostname ?? "").trim().toLowerCase());
}
