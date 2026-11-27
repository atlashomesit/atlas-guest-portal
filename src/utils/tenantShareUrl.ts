export interface TenantShareUrlOptions {
  customDomain?: string | null;
  tenantSlug: string;
  path?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  creatorCode?: string;
  baseMarketplaceOrigin?: string;
}

/**
 * MKTG-028: Ensures Share Links, QR Posters, and Creator Links are always
 * tenant-scoped even when the host has not configured a custom domain.
 */
export function buildTenantScopedShareUrl(options: TenantShareUrlOptions): string {
  const slug = options.tenantSlug.trim().toLowerCase();
  if (!slug) {
    throw new Error('tenantSlug is required to build a tenant-scoped share URL');
  }

  const normalizedPath = options.path
    ? options.path.startsWith('/')
      ? options.path
      : `/${options.path}`
    : '/';

  const cleanDomain = options.customDomain?.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const origin = cleanDomain
    ? `https://${cleanDomain}`
    : options.baseMarketplaceOrigin
      ? options.baseMarketplaceOrigin.replace(/\/+$/, '')
      : `https://${slug}.atlastays.com`;

  const url = new URL(normalizedPath, origin);

  // If falling back to a shared origin without subdomain, attach tenant query param
  if (!cleanDomain && options.baseMarketplaceOrigin && !url.hostname.startsWith(`${slug}.`)) {
    url.searchParams.set('tenant', slug);
  }

  if (options.utmSource) url.searchParams.set('utm_source', options.utmSource);
  if (options.utmMedium) url.searchParams.set('utm_medium', options.utmMedium);
  if (options.utmCampaign) url.searchParams.set('utm_campaign', options.utmCampaign);
  if (options.creatorCode) url.searchParams.set('ref', options.creatorCode.trim());

  return url.toString();
}
