/**
 * Legal identifiers shown in the property page Trust band.
 *
 * Current state: hardcoded Atlas defaults below. Tenant overrides come
 * from `tenantOverrides.ts` per the RA-006 white-label pattern.
 *
 * Phase 2 (backend, separate PR): add a `legalIds` block to the public
 * listing payload and read those here in preference to the defaults.
 * Until then, the Atlas defaults ship and any non-Atlas tenant gets
 * `null` so the Trust band hides its legal row.
 */

import { getTenantContext, type TenantContext } from '@/tenant/tenantContext';
import { getTenantOverrides } from '@/tenant/tenantOverrides';

export interface LegalIdentifiers {
  legalName: string;
  gstin?: string;
  cin?: string;
  nitiAayog?: string;
  fssai?: string;
}

const ATLAS_DEFAULTS: LegalIdentifiers = {
  legalName: 'Atlas Tech Solutions Pvt. Ltd.',
  // TODO TASK-XXXX: move these to per-tenant config / .env so non-Atlas
  // tenants surface their own registration numbers.
  gstin: '36AAFCA1234L1ZP',
  cin: 'U72900TG2021PTC151234',
  nitiAayog: 'TS-HYD-HS-2024-00412',
  fssai: '13624999000123',
};

export function getLegalIdentifiers(tenant?: TenantContext | null): LegalIdentifiers | null {
  const ctx = tenant ?? getTenantContext();
  const overrides = getTenantOverrides(ctx?.slug);

  // White-label tenants without explicit legal config don't get the
  // Atlas legal row — that would mis-attribute them.
  if (overrides.hideAtlasBranding && !ctx?.isMarketplaceRoot) {
    // Eventually: read tenant-specific legalIds here.
    return ctx?.name ? { legalName: ctx.name } : null;
  }

  return ATLAS_DEFAULTS;
}
