/**
 * TASK-10299421 / TASK-10299422: one "Powered by Atlas" link, one wording, everywhere a guest sees a
 * host's own site. The URL carries the tracking tag and the tenant slug ONLY. Never a guest, booking,
 * price, date or email value (the slug is a public subdomain label).
 */

import { getTenantContext } from './tenantContext';
import { getTenantSlug, isMarketplaceMode } from './tenantResolver';
import { hasRuntimeConfig, getRuntimeConfig } from '../runtime-config';

export const POWERED_BY_ATLAS_LABEL = 'Powered by Atlas';
export const POWERED_BY_ATLAS_BASE_URL = 'https://atlaspms.in/';

export type PoweredByAtlasMedium = 'tenant-site' | 'embed' | 'checkin';

/** Slugs are lower-case subdomain labels; anything else is dropped so no stray value can ride in the URL. */
export function sanitizePoweredBySlug(slug: string | null | undefined): string | null {
  const s = (slug ?? '').trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s) ? s : null;
}

export function buildPoweredByAtlasUrl(
  slug: string | null | undefined,
  medium: PoweredByAtlasMedium,
): string {
  const params = new URLSearchParams({ utm_source: 'powered-by', utm_medium: medium });
  const safe = sanitizePoweredBySlug(slug);
  if (safe) params.set('utm_campaign', safe);
  return `${POWERED_BY_ATLAS_BASE_URL}?${params.toString()}`;
}

/**
 * The host's slug when this is a host site, else null (the Atlas marketplace is Atlas itself and does
 * not credit itself). Same resolution order the footer has always used.
 */
export function getPoweredBySlug(): string | null {
  if (isMarketplaceMode()) return null;
  const slug = sanitizePoweredBySlug(
    getTenantContext()?.slug ||
      getTenantSlug({ fallbackSlug: hasRuntimeConfig() ? getRuntimeConfig().tenantKey : undefined }),
  );
  return slug && slug !== 'atlas' ? slug : null;
}
