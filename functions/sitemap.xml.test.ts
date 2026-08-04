import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildSitemapXml,
  listingPathSlug,
  resolveSitemapTenantSlug,
  SITEMAP_PATHS,
} from './sitemap.xml';
import { _resetTenantSlugCacheForTests } from './_lib/tenantSlug';

describe('sitemap.xml', () => {
  afterEach(() => {
    _resetTenantSlugCacheForTests();
  });

  it('includes city landing pages for all city slugs', () => {
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
});
