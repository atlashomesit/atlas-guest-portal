import { describe, it, expect } from 'vitest';
import { buildTenantScopedShareUrl } from './tenantShareUrl';

describe('MKTG-028 buildTenantScopedShareUrl', () => {
  it('uses custom domain when configured', () => {
    const url = buildTenantScopedShareUrl({
      customDomain: 'stay.coorgvilla.in',
      tenantSlug: 'coorg-villa',
      path: '/listings/201',
      utmSource: 'qr_poster',
    });
    expect(url).toBe('https://stay.coorgvilla.in/listings/201?utm_source=qr_poster');
  });

  it('falls back to tenant subdomain when no custom domain exists', () => {
    const url = buildTenantScopedShareUrl({
      tenantSlug: 'NightNest',
      path: 'rooms',
      creatorCode: 'RHEA10',
    });
    expect(url).toBe('https://nightnest.atlastays.com/rooms?ref=RHEA10');
  });

  it('appends ?tenant= when using a shared base origin', () => {
    const url = buildTenantScopedShareUrl({
      tenantSlug: 'sunset-villa',
      baseMarketplaceOrigin: 'https://atlastays.com',
      utmMedium: 'whatsapp',
    });
    expect(url).toBe('https://atlastays.com/?tenant=sunset-villa&utm_medium=whatsapp');
  });
});
