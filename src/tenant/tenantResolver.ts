/**
 * Resolves tenant slug for API context from hostname (no UI).
 * Contract: X-Tenant-Slug header; subdomain or default "atlas" in dev.
 */

const ATLAS_DOMAIN = 'atlashomestays.com';
const DEFAULT_TENANT_SLUG = 'atlas';

function getHostname(): string {
  if (typeof window === 'undefined') return '';
  return (window.location?.hostname ?? '').toLowerCase();
}

/**
 * True when running on localhost / 127.0.0.1 / *.local (dev).
 */
export function isLocalDev(): boolean {
  const host = getHostname();
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

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

  return null;
}

export type TenantResolverOptions = {
  /** Fallback slug when hostname does not resolve (e.g. localhost). From runtime config. */
  fallbackSlug?: string | null;
};

/**
 * Returns the tenant slug to send as X-Tenant-Slug.
 * Uses hostname first; on localhost/dev uses options.fallbackSlug (e.g. from runtime config).
 */
export function getTenantSlug(options: TenantResolverOptions = {}): string | null {
  const fromHost = getTenantSlugFromHostname();
  if (fromHost) return fromHost;
  const fallback = options.fallbackSlug ?? null;
  return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : null;
}
