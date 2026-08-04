/**
 * Authoritative host -> tenant-slug resolution for the Cloudflare Pages Functions layer.
 *
 * Replaces the subdomain-label GUESS that `functions/.well-known/atlas-runtime-config.json.ts`
 * used to emit as `tenantKey`. The guess produced a slug that merely *looked* right: for
 * `millionairesmansion.atlastays.com` it emitted `millionairesmansion`, while the tenant's real
 * slug is `mahesh-wagh` (`GET /tenants/millionairesmansion/public` -> 404). A subdomain label is
 * not a tenant slug and never was — see `src/tenant/tenantResolver.ts`'s deprecation note
 * ("Tenant is not derived from subdomain; use resolveFromDomain() boot-time call instead").
 *
 * `GET /tenants/from-domain?domain=<host>` is the same endpoint the browser already trusts at boot
 * (`src/tenant/tenantContext.ts`'s `resolveFromDomain`), so the emitted `tenantKey` fallback now
 * agrees with the runtime resolution instead of contradicting it.
 *
 * Mirrors `functions/_middleware.ts`'s `fetchTenantSiteMeta` shape: module-scope TTL cache, an
 * injectable `fetch` so this is unit-testable under plain Node/vitest with no Workers runtime.
 */

import { TtlCache } from "./ttlCache";

/** Matches `_middleware.ts`'s SITE_META_TTL_MS (ADR-0018 amendment: "a short TTL, e.g. 5 minutes"). */
const TENANT_SLUG_TTL_MS = 5 * 60 * 1000;

/**
 * `null` = definitively unresolved (upstream 404). Cached so a mistyped or attacker-probed host
 * does not cost an API round-trip on every config fetch. Transient failures (5xx, network throw)
 * are deliberately NOT cached — a 5-minute negative TTL on a blip would strand every tenant on
 * this Pages project with no `tenantKey` fallback long after the API recovered.
 */
const slugCache = new TtlCache<string | null>(TENANT_SLUG_TTL_MS);

/** Test-only: clear the module-scope cache between cases. */
export function _resetTenantSlugCacheForTests(): void {
  slugCache.clear();
}

/**
 * Resolves `host` to its real Atlas tenant slug, or `null` when the host is not a known tenant
 * domain (or the lookup failed). Never throws — callers treat `null` as "no fallback available"
 * and omit `tenantKey` entirely rather than substituting a guess.
 */
export async function resolveTenantSlugFromDomain(
  apiBaseUrl: string,
  host: string,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<string | null> {
  const apiBase = (apiBaseUrl ?? "").trim().replace(/\/+$/, "");
  const hostname = (host ?? "").trim().toLowerCase();
  if (!apiBase || !hostname) return null;

  const cached = slugCache.get(hostname, now);
  if (cached !== undefined) return cached;

  try {
    const res = await fetchImpl(
      `${apiBase}/tenants/from-domain?domain=${encodeURIComponent(hostname)}`,
      { headers: { Accept: "application/json" } },
    );

    if (!res.ok) {
      // 404 is a real answer ("no tenant owns this host") and is worth caching. Anything else is
      // an upstream problem — return null for this request but let the next one retry.
      if (res.status === 404) slugCache.set(hostname, null, now);
      return null;
    }

    const data = (await res.json()) as { tenantSlug?: unknown };
    const slug = typeof data?.tenantSlug === "string" ? data.tenantSlug.trim() : "";
    // A 200 with no usable slug is a contract violation, not a definitive "no tenant" — do not
    // cache it as one.
    if (!slug) return null;

    slugCache.set(hostname, slug, now);
    return slug;
  } catch {
    // Network error / invalid JSON — fail soft, uncached.
    return null;
  }
}
