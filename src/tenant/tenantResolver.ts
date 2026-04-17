/**
 * Resolves tenant slug for X-Tenant-Slug header.
 * Priority: (1) domain-resolved slug from /tenant/from-domain API call on boot,
 *           (2) runtime config tenantKey (set in /.well-known/atlas-runtime-config.json).
 */

// Set by resolveFromDomain() in tenantContext.ts during app boot.
let _domainResolvedSlug: string | null = null;

export function setDomainResolvedSlug(slug: string): void {
  _domainResolvedSlug = slug;
}

function getHostname(): string {
  if (typeof window === 'undefined') return '';
  return (window.location?.hostname ?? '').toLowerCase();
}

export function isLocalDev(): boolean {
  const host = getHostname();
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

/** @deprecated Tenant is not derived from subdomain; use resolveFromDomain() boot-time call instead. */
export function getTenantSlugFromHostname(): string | null {
  return null;
}

export type TenantResolverOptions = {
  fallbackSlug?: string | null;
};

/**
 * Returns the tenant slug to send as X-Tenant-Slug.
 * Priority: (1) domain-resolved slug (from /tenant/from-domain boot call),
 *           (2) fallbackSlug (runtime config tenantKey).
 */
export function getTenantSlug(options: TenantResolverOptions = {}): string | null {
  if (_domainResolvedSlug) return _domainResolvedSlug;
  const fallback = options.fallbackSlug ?? null;
  return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : null;
}
