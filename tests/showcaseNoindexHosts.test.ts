import { describe, it, expect } from 'vitest';
import { onRequestGet as robotsGet } from '../functions/robots.txt';
import { isNoindexHost } from '../functions/_lib/noindexHosts';

/**
 * The internal-tenant showcase host serves fabricated Atlas-branded inventory for sales demos.
 * TASK-4386's `noindex` meta tag is injected client-side by a useEffect, so it never reaches a
 * non-JS crawler — and robots.txt / sitemap.xml are the two surfaces such a crawler reads FIRST.
 * Before this change, a production showcase host answered `Allow: /` plus a Sitemap pointer that
 * enumerated every seeded listing.
 *
 * Lives in tests/ deliberately: vitest.config.ts enumerates only ["src", "tests"], so a test placed
 * beside the Function under functions/ would never execute.
 */
describe('internal-tenant host crawler suppression', () => {
  const call = (url: string, environment?: string) =>
    robotsGet({
      request: new Request(url),
      env: environment ? { ATLAS_ENVIRONMENT: environment } : {},
    });

  it('serves Disallow: / on the showcase host even in production', async () => {
    const body = await (await call('https://atlas-showcase.atlastays.com/robots.txt')).text();

    expect(body).toContain('User-agent: *');
    expect(body).toContain('Disallow: /');
    expect(body).not.toContain('Allow: /');
    // The Sitemap pointer is the specific leak: it indexes every seeded listing.
    expect(body).not.toContain('Sitemap:');
  });

  it('still serves the full production robots.txt on a normal tenant host', async () => {
    const body = await (await call('https://somehost.atlastays.com/robots.txt')).text();

    expect(body).toContain('Allow: /');
    expect(body).toContain('Sitemap: https://somehost.atlastays.com/sitemap.xml');
    expect(body).not.toContain('Disallow: /');
  });

  it('leaves the existing non-production suppression intact', async () => {
    const body = await (await call('https://dev.atlastays.com/robots.txt', 'dev')).text();

    expect(body).toContain('Disallow: /');
  });

  it('matches hosts case-insensitively and ignores unknown hosts', () => {
    expect(isNoindexHost('ATLAS-SHOWCASE.ATLASTAYS.COM')).toBe(true);
    expect(isNoindexHost('  atlas-showcase.atlastays.com  ')).toBe(true);
    expect(isNoindexHost('atlastays.com')).toBe(false);
    expect(isNoindexHost(null)).toBe(false);
    expect(isNoindexHost(undefined)).toBe(false);
  });
});
