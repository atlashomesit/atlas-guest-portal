/**
 * Resolves tenant slug from hostname for multi-tenant SaaS.
 * Contract: X-Tenant-Slug header sent on every API request.
 *
 * Production: <tenant>.atlashomestays.com -> slug "<tenant>"
 * Bare domain: atlashomestays.com -> null (marketplace landing or error)
 * Localhost:   returns null; caller uses runtime config tenantKey for dev.
 */

const ATLAS_DOMAIN = 'atlashomestays.com';

function getHostname(): string {
  if (typeof window === 'undefined') return '';
  return (window.location?.hostname ?? '').toLowerCase();
}

export function isLocalDev(): boolean {
  const host = getHostname();
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

/**
 * Extracts tenant slug from hostname.
 * - <tenant>.atlashomestays.com -> "<tenant>"
 * - atlashomestays.com (bare) -> null
 * - localhost/dev -> null (use runtime config tenantKey)
 */
export function getTenantSlugFromHostname(): string | null {
  const host = getHostname();
  if (!host) return null;

  if (isLocalDev()) return null;

  if (host === ATLAS_DOMAIN) return null;

  const suffix = `.${ATLAS_DOMAIN}`;
  if (host.endsWith(suffix)) {
    const sub = host.slice(0, -suffix.length).trim();
    return sub || null;
  }

  return null;
}

export type TenantResolverOptions = {
  fallbackSlug?: string | null;
};

/**
 * Returns the tenant slug to send as X-Tenant-Slug.
 * Priority: hostname subdomain -> fallback (runtime config tenantKey, dev only).
 */
export function getTenantSlug(options: TenantResolverOptions = {}): string | null {
  const fromHost = getTenantSlugFromHostname();
  if (fromHost) return fromHost;
  const fallback = options.fallbackSlug ?? null;
  return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : null;
}
