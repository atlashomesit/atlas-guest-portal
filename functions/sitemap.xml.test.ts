import { describe, it, expect } from 'vitest';
import { buildSitemapXml, SITEMAP_PATHS } from './sitemap.xml';

describe('sitemap.xml', () => {
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
});
