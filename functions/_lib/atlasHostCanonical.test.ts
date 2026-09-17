import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildAtlasHostCanonical, isAtlasSelfCanonicalHost, resolveSiteOrigin } from './atlasHostCanonical';
import { isAtlasDirectBookingHost, isRewriteEligibleHost } from './tenantSiteMeta';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('isAtlasSelfCanonicalHost (TASK-101940)', () => {
  it.each(['atlashomestays.com', 'dev.atlashomestays.com', 'qa.atlashomestays.com', 'localhost', '127.0.0.1', '  QA.AtlasHomestays.com '])(
    'accepts Atlas direct-booking host %j',
    (host) => {
      expect(isAtlasSelfCanonicalHost(host)).toBe(true);
    },
  );

  it.each([
    // duplicate aliases of the apex (measured 200, no redirect)
    'www.atlashomestays.com',
    'atlashomes.in',
    'www.atlashomes.in',
    // marketplace family
    'atlastays.com',
    'www.atlastays.com',
    'dev.atlastays.com',
    // tenant subdomains, custom domains, the Pages origin, look-alikes, junk
    'starguesthouse.atlastays.com',
    'dev-e2e-whitelabel.atlastays.com',
    'www.sunnyvilla.in',
    'atlas-guest-portal.pages.dev',
    'qa.atlashomestays.com.evil.example',
    'evilatlashomestays.com',
    '',
    null,
    undefined,
  ])('rejects %j', (host) => {
    expect(isAtlasSelfCanonicalHost(host)).toBe(false);
  });

  it('is a strict subset of the Atlas direct-booking hosts, so no tenant host can ever qualify', () => {
    const sample = [
      'atlashomestays.com', 'www.atlashomestays.com', 'atlashomes.in', 'www.atlashomes.in',
      'dev.atlashomestays.com', 'qa.atlashomestays.com', 'localhost', '127.0.0.1',
      'atlastays.com', 'www.atlastays.com', 'dev.atlastays.com', 'starguesthouse.atlastays.com',
      'www.sunnyvilla.in', 'atlas-guest-portal.pages.dev', 'qa.atlashomestays.com.evil.example',
    ];
    for (const host of sample) {
      if (!isAtlasSelfCanonicalHost(host)) continue;
      expect(isAtlasDirectBookingHost(host), host).toBe(true);
      expect(isRewriteEligibleHost(host), host).toBe(false);
    }
  });
});

describe('resolveSiteOrigin mirrors getPublicSiteOrigin()', () => {
  it.each([
    [undefined, 'https://qa.atlashomestays.com'],
    ['', 'https://qa.atlashomestays.com'],
    ['   ', 'https://qa.atlashomestays.com'],
    ['www.example.com', 'https://qa.atlashomestays.com'], // no scheme → ignored, like the SPA
    ['ftp://example.com', 'https://qa.atlashomestays.com'],
    ['https://www.example.com', 'https://www.example.com'],
    [' https://www.example.com/// ', 'https://www.example.com'],
    ['HTTP://Example.com/', 'HTTP://Example.com'],
  ])('configured %j → %j', (configured, expected) => {
    expect(resolveSiteOrigin(configured, 'https://qa.atlashomestays.com')).toBe(expected);
  });
});

describe('buildAtlasHostCanonical', () => {
  it.each([
    ['https://atlashomestays.com/', 'https://atlashomestays.com/'],
    ['https://qa.atlashomestays.com/?utm_source=whatsapp&ref=1#top', 'https://qa.atlashomestays.com/'],
    ['http://localhost:5173/', 'http://localhost:5173/'],
  ])('home %s → %s (query and fragment dropped)', (url, expected) => {
    expect(buildAtlasHostCanonical(url)).toBe(expected);
  });

  it('home uses a configured site origin; the property page does not', () => {
    expect(buildAtlasHostCanonical('https://qa.atlashomestays.com/', 'https://atlashomestays.com/')).toBe(
      'https://atlashomestays.com/',
    );
    expect(
      buildAtlasHostCanonical('https://qa.atlashomestays.com/homes/atlas-homes/1', 'https://atlashomestays.com/'),
    ).toBe('https://qa.atlashomestays.com/homes/atlas-homes/1');
  });

  it.each([
    ['https://qa.atlashomestays.com/homes/atlas-homes/1', 'https://qa.atlashomestays.com/homes/atlas-homes/1'],
    [
      'https://atlashomestays.com/homes/atlas-homes/1?checkin=2026-10-01&checkout=2026-10-03&guests=2',
      'https://atlashomestays.com/homes/atlas-homes/1?checkin=2026-10-01&checkout=2026-10-03&guests=2',
    ],
    ['https://atlashomestays.com/homes/atlas-homes/1/', 'https://atlashomestays.com/homes/atlas-homes/1/'],
    ['https://atlashomestays.com/HOMES/Atlas-Homes/1', 'https://atlashomestays.com/HOMES/Atlas-Homes/1'],
    ['https://atlashomestays.com/homes/atlas-homes/1?', 'https://atlashomestays.com/homes/atlas-homes/1?'],
    ['https://atlashomestays.com/homes/atlas-homes/1#gallery', 'https://atlashomestays.com/homes/atlas-homes/1'],
  ])('property page %s → %s (location.href)', (url, expected) => {
    expect(buildAtlasHostCanonical(url)).toBe(expected);
  });

  it('percent-encodes markup characters, so the value can never break out of the attribute', () => {
    const canonical = buildAtlasHostCanonical('https://atlashomestays.com/homes/a"><script>/1?q="<x>\'');
    expect(canonical).not.toMatch(/["<>]/);
  });

  it.each([
    '/search?city=goa&guests=2',
    '/faq',
    '/terms',
    '/homestays-in-goa',
    '/blog/essential-guest-guide',
    '/homes/101',
    '/homes/a/b/c',
    '/homes//1',
    '/book/atlas-homes/1/details',
    '/abc123',
    '/index.html',
    '/sitemap.xml',
    '/robots.txt',
    '/assets/index-abc.js',
    '/api/public/tenant-site-meta',
    '//homes/a/1',
  ])('returns null for %s (no URL-derived canonical in the SPA)', (path) => {
    expect(buildAtlasHostCanonical(`https://atlashomestays.com${path}`)).toBeNull();
  });
});

/**
 * DRIFT TRIPWIRE. The edge value is only correct while the SPA still computes the canonical the
 * way `atlasHostCanonical.ts` copies it. If any assertion below fails, the SPA changed: update
 * `buildAtlasHostCanonical` to the new formula in the same change — do not just edit the test.
 */
describe('SPA canonical formulas mirrored at the edge', () => {
  /** Resolves the file a theme's `index.tsx` exports as `exportName`. */
  function themeExportFile(theme: string, exportName: string): string {
    const indexRel = `src/themes/${theme}/index.tsx`;
    const index = read(indexRel);
    const local = index.match(new RegExp(`export const ${exportName} = (\\w+);`))?.[1];
    expect(local, `${indexRel} exports ${exportName}`).toBeTruthy();
    const spec = index.match(new RegExp(`import ${local} from ["']([^"']+)["']`))?.[1];
    expect(spec, `${indexRel} imports ${local}`).toBeTruthy();
    const base = spec!.startsWith('@/') ? join(ROOT, 'src', spec!.slice(2)) : resolve(ROOT, 'src/themes', theme, spec!);
    const file = [`${base}.tsx`, `${base}.ts`].find((f) => existsSync(f));
    expect(file, `${spec} resolves to a file`).toBeTruthy();
    return file!;
  }

  const themes = readdirSync(join(ROOT, 'src/themes'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(ROOT, 'src/themes', d.name, 'index.tsx')))
    .map((d) => d.name);

  it('covers every layout theme the registry can load (an empty list would pass the loops below vacuously)', () => {
    const registered = Array.from(read('src/themes/registry.ts').matchAll(/import\("\.\/(\w+)"\)/g)).map((m) => m[1]);
    expect(registered).toEqual(expect.arrayContaining(['classic', 'heritage']));
    expect(themes.slice().sort()).toEqual(registered.slice().sort());
  });

  it('SEO.tsx updates the ONE existing canonical/og:url with the route url (never appends when present)', () => {
    const seo = read('src/components/SEO.tsx');
    const query = seo.indexOf(`document.querySelector("link[rel='canonical']")`);
    const create = seo.indexOf(`canonical = document.createElement("link")`);
    expect(query).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(query);
    expect(seo).toContain('if (!canonical) {');
    expect(seo).toContain('canonical.href = url ?? "";');
    expect(seo).toContain('ogUrl.content = url ?? "";');
  });

  it('getPublicSiteOrigin() is VITE_PUBLIC_SITE_ORIGIN (http/https, trailing slashes stripped) else window.location.origin', () => {
    const siteOrigin = read('src/config/siteOrigin.ts');
    expect(siteOrigin).toContain('import.meta.env.VITE_PUBLIC_SITE_ORIGIN');
    expect(siteOrigin).toContain('if (trimmed && /^https?:\\/\\//i.test(trimmed)) {');
    expect(siteOrigin).toContain('return trimmed.replace(/\\/+$/, "");');
    expect(siteOrigin).toContain('return window.location.origin;');
  });

  it('`/` renders the marketplace home or the theme Home, and every one of them canonicalises to `${getPublicSiteOrigin()}/`', () => {
    const app = read('src/App.tsx');
    const rootRoute = app.match(/<Route\s+path="\/"\s+element=\{([\s\S]*?)\}\s*\/>/)?.[1] ?? '';
    expect(rootRoute).toContain('<MarketplaceHomepage />');
    expect(rootRoute).toContain('<Home />');
    expect(app).toContain('default: mod.Home }');

    expect(read('src/pages/MarketplaceHomepage.tsx')).toContain('url={`${getPublicSiteOrigin()}/`}');
    for (const theme of themes) {
      const home = readFileSync(themeExportFile(theme, 'Home'), 'utf8');
      expect(home, `${theme} Home`).toContain('const canonicalUrl = `${getPublicSiteOrigin()}/`;');
      expect(home, `${theme} Home`).toContain('url={canonicalUrl}');
    }
  });

  it('`/homes/:propertySlug/:unitSlug` is the only 2-segment /homes route, and every theme page canonicalises to window.location.href', () => {
    const app = read('src/App.tsx');
    const homesRoutes = Array.from(app.matchAll(/path="(\/homes\/[^"]*)"/g)).map((m) => m[1]).sort();
    expect(homesRoutes).toEqual(['/homes/:propertySlug/:unitSlug', '/homes/:roomNo']);
    expect(app).toMatch(/path="\/homes\/:propertySlug\/:unitSlug" element=\{[^\n]*<Homepage_PropertyDetails \/>/);
    expect(app).toContain('default: mod.PropertyDetails }');

    for (const theme of themes) {
      const page = readFileSync(themeExportFile(theme, 'PropertyDetails'), 'utf8');
      expect(page, `${theme} PropertyDetails`).toContain(
        "const pageUrl = typeof window !== 'undefined' ? window.location.href : '';",
      );
      expect(page, `${theme} PropertyDetails`).toContain('url={pageUrl}');
    }
  });
});
