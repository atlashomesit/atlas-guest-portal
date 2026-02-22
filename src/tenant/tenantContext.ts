/**
 * Tenant context for the guest portal.
 * After runtime config loads, call validateTenant() to verify the tenant exists
 * and fetch branding from the API. The resolved tenant info is stored in-memory
 * and available via getTenantContext().
 */

import { getApiHeaders, buildApiUrl } from '@/api/client';

export interface TenantInfo {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string;
  brandColor?: string;
}

let tenantInfo: TenantInfo | null = null;

export function getTenantContext(): TenantInfo | null {
  return tenantInfo;
}

/**
 * Validates the tenant slug against the API and stores branding info.
 * Throws if the tenant does not exist or is inactive.
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
    brandColor: data.brandColor ?? undefined,
  };
  return tenantInfo;
}
