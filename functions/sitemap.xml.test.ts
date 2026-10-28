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
// MKT-010: assert against the SAME helpers the marketplace card calls (src/utils/navigation.ts),
// not a hand-typed literal — that way the sitemap path cannot drift from the card path again.
import { buildHomeUnitPath, getPropertySlug } from '../src/utils/navigation';

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
    // MKT-014 / MKT-017: include the city slugs (bengaluru, gurugram, nashik, guwahati, jalandhar) that the
    // CityLandingPage now serves alongside the original four.
    const cityLandingSlugs = ["goa", "coorg", "hyderabad", "manali", "bengaluru", "gurugram", "nashik", "guwahati", "jalandhar"];
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

  // MKT-010: when /marketplace/listings returns slug == String(id) (the current bug — 28/28 rows),
  // the sitemap URL must still point at the title slug the marketplace card emits, so the soft-404
  // /homes/<id>/<id> URL stops being handed to Google. Asserted against the card helpers
  // (getPropertySlug + buildHomeUnitPath), NOT a hand-typed literal — the whole point of the
  // import-the-same-helper fix is that these cannot drift apart.
  it('MKT-010: marketplaceListingPath uses the title slug, not the API slug field', () => {
    const row = { id: 676, tenantSlug: 'grove-and-co', title: 'The Estate by Grove & Co.', slug: '676' };
    const path = marketplaceListingPath(row, { allowAtlasHomesFallback: true });
    const expectedCardPath = `${buildHomeUnitPath(getPropertySlug({ property_name: row.title }), row.id)}?tenant=${encodeURIComponent(row.tenantSlug)}`;
    expect(path).toBe(expectedCardPath);
    expect(path).toBe('/homes/the-estate-by-grove-co/676?tenant=grove-and-co');
    expect(path).not.toContain('/homes/676/');
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

  // MKT-040: the /destinations hub (MKT-034) is Atlas marketplace content, so the Atlas sitemaps list it and a white-label tenant
  // sitemap never does (the page itself sends a white-label domain home).
  it('MKT-040: the full Atlas sitemap lists /destinations and every city guide; the shared (tenant) paths list neither', () => {
    expect(SITEMAP_PATHS).toContain('/destinations');
    expect(SHARED_SITEMAP_PATHS).not.toContain('/destinations');
    for (const slug of ['goa', 'coorg', 'hyderabad', 'manali', 'bengaluru', 'gurugram', 'nashik', 'guwahati', 'jalandhar']) {
      expect(SITEMAP_PATHS).toContain(`/homestays-in-${slug}`);
    }
    // /explore is an alias of /destinations; one canonical URL per page.
    expect(SITEMAP_PATHS).not.toContain('/explore');
    expect(buildSitemapXml('https://atlastays.com', SITEMAP_PATHS)).toContain('<loc>https://atlastays.com/destinations</loc>');
  });

  it('MKT-040: the marketplace host sitemap lists /destinations, with supply known and with the supply lookup failing', async () => {
    const listingsOk = vi.fn(async (url: string) =>
      String(url).includes('/marketplace/listings')
        ? new Response(
            JSON.stringify({
              items: [{ id: 2, tenantSlug: 'sahil-goyal', title: 'Calangute Beach Villa', city: 'Goa' }],
              total: 1,
            }),
            { status: 200 },
          )
        : new Response('not found', { status: 404 }),
    );
    vi.stubGlobal('fetch', listingsOk);
    try {
      const res = await onRequestGet({
        request: new Request('https://atlastays.com/sitemap.xml'),
        env: { ATLAS_API_BASE_URL: 'https://api.example.com' },
      });
      const xml = await res.text();
      expect(xml).toContain('<loc>https://atlastays.com/destinations</loc>');
      expect(xml).toContain('<loc>https://atlastays.com/homestays-in-goa</loc>');
    } finally {
      vi.unstubAllGlobals();
    }

    // Supply unknown (the listings call throws): no city guide is advertised (unchanged), but the hub does not depend on supply.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    try {
      const res = await onRequestGet({
        request: new Request('https://atlastays.com/sitemap.xml'),
        env: { ATLAS_API_BASE_URL: 'https://api.example.com' },
      });
      const xml = await res.text();
      expect(xml).toContain('<loc>https://atlastays.com/destinations</loc>');
      expect(xml).not.toContain('/homestays-in-');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('MKT-040: a white-label tenant host sitemap does not list /destinations', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      String(url).includes('/tenants/from-domain')
        ? new Response(JSON.stringify({ tenantSlug: 'sunrise' }), { status: 200 })
        : new Response('[]', { status: 200 }),
    ));
    try {
      const res = await onRequestGet({
        request: new Request('https://stay.sunrise.example/sitemap.xml'),
        env: { ATLAS_API_BASE_URL: 'https://api.example.com' },
      });
      const xml = await res.text();
      expect(xml).not.toContain('/destinations');
      expect(xml).not.toContain('/homestays-in-');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
