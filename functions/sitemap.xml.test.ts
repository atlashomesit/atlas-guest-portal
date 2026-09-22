import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildSitemapXml,
  citySlugsWithMarketplaceSupply,
  listingPathSlug,
  marketplaceListingPath,
  onRequestGet,
  resolveSitemapTenantSlug,
  SHARED_SITEMAP_PATHS,
  SITEMAP_PATHS,
} from './sitemap.xml';
import { _resetTenantSlugCacheForTests } from './_lib/tenantSlug';

describe('sitemap.xml', () => {
  afterEach(() => {
    _resetTenantSlugCacheForTests();
  });

  // TASK-7430 / TASK-7194: white-label hosts must not advertise Atlas SEO city guides in sitemap.xml
  it('TASK-7194: SHARED_SITEMAP_PATHS omits Atlas city landing pages', () => {
    expect(SHARED_SITEMAP_PATHS).not.toContain('/homestays-in-hyderabad');
    expect(SITEMAP_PATHS).toContain('/homestays-in-hyderabad');
  });

  it('includes city landing pages for all city slugs in the full marketplace sitemap', () => {
    const cityLandingSlugs = ["goa", "coorg", "hyderabad", "manali"];
    const expectedPaths = cityLandingSlugs.map((slug) => `/homestays-in-${slug}`);

    expectedPaths.forEach((path) => {
      expect(SITEMAP_PATHS).toContain(path);
    });
  });

  it('builds valid sitemap XML with city landing pages', () => {
    const paths = ["/", "/blog", "/homestays-in-goa", "/homestays-in-hyderabad"];
    const xml = buildSitemapXml("https://example.com", paths);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://example.com/</loc>');
    expect(xml).toContain('<loc>https://example.com/homestays-in-goa</loc>');
    expect(xml).toContain('<loc>https://example.com/homestays-in-hyderabad</loc>');
    expect(xml).toContain('</urlset>');
  });

  // TASK-7430: never emit /homes/atlas-homes/... for a non-Atlas host
  it('TASK-7430: listingPathSlug rejects atlas-homes fallback on white-label hosts', () => {
    expect(
      listingPathSlug({ id: 42, propertyName: '' }, { allowAtlasHomesFallback: false }),
    ).toBe('home-42');
    expect(
      listingPathSlug({ id: 42, propertyName: 'Atlas Homes' }, { allowAtlasHomesFallback: false }),
    ).toBe('home-42');
    expect(
      listingPathSlug({ id: 42, propertyName: 'Sunrise Villa' }, { allowAtlasHomesFallback: false }),
    ).toBe('sunrise-villa');
  });

  it('TASK-7430: resolveSitemapTenantSlug uses from-domain for custom hosts', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ tenantSlug: 'sunrise' }), { status: 200 }),
    );

    const result = await resolveSitemapTenantSlug(
      'stay.sunrise.example',
      'https://api.example.com',
      'atlas',
      fetchSpy as unknown as typeof fetch,
    );

    expect(result.tenantSlug).toBe('sunrise');
    expect(result.allowAtlasHomesFallback).toBe(false);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/tenants/from-domain');
  });

  it('TASK-7430: tenant sitemap paths are exactly the N real listing URLs (no atlas-homes)', () => {
    const listings = [
      { id: 180, propertyName: 'Stay by City Focus' },
      { id: 191, propertyName: 'Elsiya loft' },
      { id: 62, propertySlug: 'stay-by-city-focus' },
    ];
    const listingPaths = listings.map((l) => {
      const slug = listingPathSlug(l, { allowAtlasHomesFallback: false });
      return `/homes/${slug}/${l.id}`;
    });

    expect(listingPaths).toHaveLength(3);
    expect(listingPaths).toEqual([
      '/homes/stay-by-city-focus/180',
      '/homes/elsiya-loft/191',
      '/homes/stay-by-city-focus/62',
    ]);
    expect(listingPaths.every((p) => !p.includes('atlas-homes'))).toBe(true);

    const xml = buildSitemapXml('https://staybycf.atlastays.com', listingPaths);
    for (const path of listingPaths) {
      expect(xml).toContain(`<loc>https://staybycf.atlastays.com${path}</loc>`);
    }
    expect(xml).not.toContain('atlas-homes');
  });

  // MKT-006: a homestays-in-<city> URL is offered only when the marketplace has ≥1 matching listing.
  it('MKT-006: citySlugsWithMarketplaceSupply drops cities with zero live listings', () => {
    const listings = [
      { id: 1, tenantSlug: 'atlas', title: 'KPHB 7th Phase 2BHK', city: null },
      { id: 2, tenantSlug: 'sahil-goyal', title: 'Calangute Beach Villa', city: 'Goa' },
    ];
    expect(citySlugsWithMarketplaceSupply(listings)).toEqual(
      expect.arrayContaining(['hyderabad', 'goa']),
    );
    expect(citySlugsWithMarketplaceSupply(listings)).not.toContain('coorg');
    expect(citySlugsWithMarketplaceSupply(listings)).not.toContain('manali');
  });

  it('MKT-006: marketplaceListingPath carries ?tenant= for the cross-tenant listing', () => {
    const path = marketplaceListingPath(
      { id: 191, tenantSlug: 'staybycf', title: 'Elsiya loft' },
      { allowAtlasHomesFallback: true },
    );
    expect(path).toBe('/homes/elsiya-loft/191?tenant=staybycf');
  });

  // MKT-006: the marketplace host previously advertised 0 /homes/ URLs and offered
  // /homestays-in-coorg + /homestays-in-manali with zero supply — this reproduces the RED state
  // before the fix (tenantSlug: null skipped listing enumeration entirely) and asserts the fix.
  it('MKT-006: marketplace host sitemap enumerates cross-tenant listings and drops empty cities', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/marketplace/listings')) {
        return new Response(
          JSON.stringify({
            items: [
              { id: 1, tenantSlug: 'atlas', title: 'KPHB 7th Phase 2BHK', city: null },
              { id: 2, tenantSlug: 'sahil-goyal', title: 'Calangute Beach Villa', city: 'Goa' },
            ],
            total: 2,
          }),
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const res = await onRequestGet({
        request: new Request('https://atlastays.com/sitemap.xml'),
        env: { ATLAS_API_BASE_URL: 'https://api.example.com' },
      });
      const xml = await res.text();

      expect(xml).toContain('<loc>https://atlastays.com/homes/kphb-7th-phase-2bhk/1?tenant=atlas</loc>');
      expect(xml).toContain(
        '<loc>https://atlastays.com/homes/calangute-beach-villa/2?tenant=sahil-goyal</loc>',
      );
      expect(xml).toContain('<loc>https://atlastays.com/homestays-in-hyderabad</loc>');
      expect(xml).toContain('<loc>https://atlastays.com/homestays-in-goa</loc>');
      expect(xml).not.toContain('/homestays-in-coorg');
      expect(xml).not.toContain('/homestays-in-manali');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
