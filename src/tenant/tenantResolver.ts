/**
<<<<<<< HEAD
 * Resolves tenant slug for API context from hostname (no UI).
 * Contract: X-Tenant-Slug header; subdomain or default "atlas" in dev.
 */

const ATLAS_DOMAIN = 'atlashomestays.com';
const DEFAULT_TENANT_SLUG = 'atlas';

=======
 * Resolves tenant slug for X-Tenant-Slug header.
 * Tenant comes only from runtime config (tenantKey / ATLAS_TENANT_KEY), not from subdomain.
 */

>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
function getHostname(): string {
  if (typeof window === 'undefined') return '';
  return (window.location?.hostname ?? '').toLowerCase();
}

<<<<<<< HEAD
/**
 * True when running on localhost / 127.0.0.1 / *.local (dev).
 */
=======
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
export function isLocalDev(): boolean {
  const host = getHostname();
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

<<<<<<< HEAD
/**
 * Resolves tenant slug from hostname.
 * - atlashomestays.com → "atlas"
 * - &lt;tenant&gt;.atlashomestays.com → "&lt;tenant&gt;"
 * - localhost/dev: returns null so caller can use runtime config fallback.
 */
export function getTenantSlugFromHostname(): string | null {
  const host = getHostname();
  if (!host) return null;

  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    return null; // Caller uses runtime config tenantKey for dev
  }

  if (host === ATLAS_DOMAIN) {
    return DEFAULT_TENANT_SLUG;
  }

  const suffix = `.${ATLAS_DOMAIN}`;
  if (host.endsWith(suffix)) {
    const sub = host.slice(0, -suffix.length).trim();
    return sub || DEFAULT_TENANT_SLUG;
  }

=======
/** @deprecated Tenant is not derived from subdomain; use config tenantKey only. */
export function getTenantSlugFromHostname(): string | null {
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
  return null;
}

export type TenantResolverOptions = {
<<<<<<< HEAD
  /** Fallback slug when hostname does not resolve (e.g. localhost). From runtime config. */
=======
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
  fallbackSlug?: string | null;
};

/**
 * Returns the tenant slug to send as X-Tenant-Slug.
<<<<<<< HEAD
 * Uses hostname first; on localhost/dev uses options.fallbackSlug (e.g. from runtime config).
 */
export function getTenantSlug(options: TenantResolverOptions = {}): string | null {
  const fromHost = getTenantSlugFromHostname();
  if (fromHost) return fromHost;
=======
 * Tenant is from runtime config only (tenantKey / ATLAS_TENANT_KEY), not from hostname/subdomain.
 */
export function getTenantSlug(options: TenantResolverOptions = {}): string | null {
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
  const fallback = options.fallbackSlug ?? null;
  return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : null;
}
