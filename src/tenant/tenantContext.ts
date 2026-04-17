/**
 * Tenant context for the guest portal.
 * On boot, call resolveFromDomain() first — it calls /tenants/from-domain and sets
 * the tenant slug + brand config without needing X-Tenant-Slug or a known slug.
 * Falls back to validateTenant(slug) if domain resolution fails.
 * The resolved tenant info is stored in-memory and available via getTenantContext().
 */

import { getApiHeaders, buildApiUrl } from '@/api/client';
import { setDomainResolvedSlug } from '@/tenant/tenantResolver';

export interface TenantInfo {
  id?: number;
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor?: string;
  tagline?: string;
  faviconUrl?: string;
  /** @deprecated Use primaryColor */
  brandColor?: string;
}

let tenantInfo: TenantInfo | null = null;

export function getTenantContext(): TenantInfo | null {
  return tenantInfo;
}

/**
 * Boot-time tenant resolution via domain.
 * Calls GET /tenants/from-domain?domain=<hostname> — no auth, no X-Tenant-Slug needed.
 * On success: stores tenant info + sets the resolved slug for all subsequent API calls.
 * On failure (404 / network error): returns null — caller should fall back to validateTenant().
 */
export async function resolveFromDomain(apiBaseUrl: string, domain: string): Promise<TenantInfo | null> {
  try {
    const url = `${apiBaseUrl.replace(/\/$/, '')}/tenants/from-domain?domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url); // No auth headers — this is the bootstrap endpoint

    if (!res.ok) return null;

    const data = await res.json();
    const slug = data.tenantSlug as string;
    if (!slug) return null;

    setDomainResolvedSlug(slug);

    tenantInfo = {
      name: data.brandName ?? '',
      slug,
      logoUrl: data.logoUrl ?? undefined,
      primaryColor: data.primaryColor ?? undefined,
      tagline: data.tagline ?? undefined,
      faviconUrl: data.faviconUrl ?? undefined,
      brandColor: data.primaryColor ?? undefined, // backward compat
    };
    return tenantInfo;
  } catch {
    return null; // Network error — caller falls back to validateTenant()
  }
}

/**
 * Validates the tenant slug against the API and stores branding info.
 * Throws if the tenant does not exist or is inactive.
 * Use resolveFromDomain() on boot instead when possible.
 */
export async function validateTenant(slug: string): Promise<TenantInfo> {
  const url = buildApiUrl(`/tenants/${encodeURIComponent(slug)}/public`);
  const res = await fetch(url, { headers: getApiHeaders() });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Tenant "${slug}" not found. Check /.well-known/atlas-runtime-config.json and ensure tenantKey (or ATLAS_TENANT_KEY) is a valid tenant slug.`);
    }
    throw new Error(`Failed to validate tenant "${slug}" (${res.status}).`);
  }

  const data = await res.json();
  tenantInfo = {
    id: data.id,
    name: data.name,
    slug: data.slug,
    logoUrl: data.logoUrl ?? undefined,
    primaryColor: data.brandColor ?? undefined,
    brandColor: data.brandColor ?? undefined,
  };
  return tenantInfo;
}
