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
 */  return null;
}

export type TenantResolverOptions = {
  /** Fallback slug when hostname does not resolve (e.g. localhost). From runtime config. */  const fallback = options.fallbackSlug ?? null;
  return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : null;
}
