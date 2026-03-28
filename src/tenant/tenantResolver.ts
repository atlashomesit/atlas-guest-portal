/**
 * Resolves tenant slug for X-Tenant-Slug header.
 * Tenant comes only from runtime config (tenantKey / ATLAS_TENANT_KEY), not from subdomain.
 */

function getHostname(): string {
  if (typeof window === 'undefined') return '';
  return (window.location?.hostname ?? '').toLowerCase();
}

export function isLocalDev(): boolean {
  const host = getHostname();
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

/** @deprecated Tenant is not derived from subdomain; use config tenantKey only. */
export function getTenantSlugFromHostname(): string | null {
  return null;
}

export type TenantResolverOptions = {
  fallbackSlug?: string | null;
};

/**
 * Returns the tenant slug to send as X-Tenant-Slug.
 * Tenant is from runtime config only (tenantKey / ATLAS_TENANT_KEY), not from hostname/subdomain.
 */
export function getTenantSlug(options: TenantResolverOptions = {}): string | null {
  const fallback = options.fallbackSlug ?? null;
  return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : null;
}
