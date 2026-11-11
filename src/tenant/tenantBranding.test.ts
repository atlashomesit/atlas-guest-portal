/**
 * Per-tenant brand-asset scoping (Stay by City Focus).
 *
 * API-configured artwork must apply only to its tenant:
 * the staybycf branded subdomain gets its logo/favicon, while every other
 * tenant (incl. the atlastays.com marketplace apex) keeps API values or the
 * brand-neutral defaults.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTenantBranding } from './tenantBranding';
import type { TenantInfo } from './tenantContext';

const STATIC_FAVICON = '/favicon.ico';

function makeTenant(overrides: Partial<TenantInfo> & Pick<TenantInfo, 'slug'>): TenantInfo {
  return {
    name: 'Test Tenant',
    showAtlasFooterCredit: false,
    isCustomDomain: true,
    ...overrides,
  };
}

function faviconHref(): string | null {
  return document.querySelector<HTMLLinkElement>("link[rel~='icon']")?.getAttribute('href') ?? null;
}

describe('applyTenantBranding — per-tenant brand assets', () => {
  beforeEach(() => {
    // Static default favicon as shipped in index.html.
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = STATIC_FAVICON;
    document.head.appendChild(link);
    // Silence the web-manifest fetch (jsdom has fetch under Node 18+).
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  });

  afterEach(() => {
    document.head.querySelectorAll("link[rel~='icon']").forEach((el) => el.remove());
    document.documentElement.style.removeProperty('--brand-logo-url');
    vi.unstubAllGlobals();
  });

  // Tenant assets migrated out of slug overrides: the DTO is now the source of truth.
  for (const slug of ['staybycf', 'goan-hideaway']) {
    it(`keeps ${slug} neutral when no brand assets are configured`, () => {
      applyTenantBranding(makeTenant({ slug }));
      expect(faviconHref()).toBe(STATIC_FAVICON);
      expect(document.documentElement.style.getPropertyValue('--brand-logo-url')).toBe('');
    });
    it(`uses configured assets for ${slug}`, () => {
      applyTenantBranding(makeTenant({ slug, logoUrl: '/synthetic/logo.png', faviconUrl: '/synthetic/icon.png' }));
      expect(faviconHref()).toBe('/synthetic/icon.png');
      expect(document.documentElement.style.getPropertyValue('--brand-logo-url')).toContain('/synthetic/logo.png');
    });
  }

  it('leaves other tenants on the neutral static favicon with no logo var', () => {
    applyTenantBranding(makeTenant({ slug: 'some-other-tenant' }));

    expect(faviconHref()).toBe(STATIC_FAVICON);
    expect(document.documentElement.style.getPropertyValue('--brand-logo-url')).toBe('');
  });

  it('applies the Atlas Homes lockup for the atlas marketplace slug only', () => {
    applyTenantBranding(makeTenant({ slug: 'atlas', name: 'Atlastays', isCustomDomain: false }));

    expect(faviconHref()).toBe('/images/atlas-homes-logo.png');
    expect(document.documentElement.style.getPropertyValue('--brand-logo-url')).toContain(
      'atlas-homes-logo',
    );
    expect(document.documentElement.style.getPropertyValue('--brand-logo-url')).not.toContain(
      'stay-bycityfocus',
    );
  });

  it('leaves the atlas marketplace tenant untouched by the staybycf artwork', () => {
    applyTenantBranding(makeTenant({ slug: 'atlas', name: 'Atlastays', isCustomDomain: false }));

    expect(faviconHref()).toBe('/images/atlas-homes-logo.png');
    expect(document.documentElement.style.getPropertyValue('--brand-logo-url')).not.toContain(
      'stay-bycityfocus',
    );
  });

  it('still honours API-provided logo/favicon for tenants without repo overrides', () => {
    applyTenantBranding(
      makeTenant({
        slug: 'api-tenant',
        logoUrl: 'https://cdn.example.com/logo.png',
        faviconUrl: 'https://cdn.example.com/favicon.ico',
      }),
    );

    expect(faviconHref()).toBe('https://cdn.example.com/favicon.ico');
    expect(document.documentElement.style.getPropertyValue('--brand-logo-url')).toContain(
      'cdn.example.com/logo.png',
    );
  });
});

// ---------------------------------------------------------------------------
// TASK-4899: document.title / apple-mobile-web-app-title no-brand-configured fallback
// must be brand-neutral for a Neutral-mode tenant, never "Atlastays".
// ---------------------------------------------------------------------------
describe('applyTenantBranding — TASK-4899 no-brand-configured fallback', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('neutral-no-branding: document.title falls back to the generic property-only name, never an Atlas mark', () => {
    applyTenantBranding(makeTenant({ slug: 'brand-new-tenant', name: '', guestCommsBrandingMode: 'Neutral' }));
    expect(document.title.toLowerCase()).not.toContain('atlas');
    expect(document.title).toBe('Your Stay');
  });

  it('neutral-with-branding: document.title uses the configured business display name unchanged', () => {
    applyTenantBranding(
      makeTenant({
        slug: 'gaurav',
        name: 'Gaurav Personal',
        guestCommsBrandingMode: 'Neutral',
        legalContactPack: {
          displayName: 'Elsiya Loft',
          showAtlasFooterCredit: false,
          isCustomDomain: false,
        },
      }),
    );
    expect(document.title).toBe('Elsiya Loft');
  });

  it('TASK-7468: neutral with only a personal Tenants.Name never publishes it as the title', () => {
    applyTenantBranding(makeTenant({ slug: 'sunrise', name: 'Sunrise Short', guestCommsBrandingMode: 'Neutral' }));
    expect(document.title).toBe('Your Stay');
  });

  it('platform-mode regression: unset name still falls back to the Atlas marketplace baseline', () => {
    applyTenantBranding(makeTenant({ slug: 'atlas', name: '', guestCommsBrandingMode: 'Platform' }));
    expect(document.title).toBe('Atlastays');
  });

  it('API-gap regression: unset name + undefined guestCommsBrandingMode still falls back to the Atlas marketplace baseline', () => {
    applyTenantBranding(makeTenant({ slug: 'some-tenant', name: '' }));
    expect(document.title).toBe('Atlastays');
  });
});

// ---------------------------------------------------------------------------
// TASK-103033: dynamic tenant PWA manifest (applyTenantWebManifest) generates
// a blob: URL. The CSP in public/_headers must allow blob: in manifest-src
// for both /embed/* and /* so tenant portals don't block the manifest.
// ---------------------------------------------------------------------------
describe('public/_headers CSP manifest-src for PWA dynamic manifest (TASK-103033)', () => {
  const headersPath = resolve(__dirname, '../../public/_headers');
  const headersFile = readFileSync(headersPath, 'utf-8');

  function cspForRule(rule: string): string {
    const lines = headersFile.split(/\r?\n/);
    const idx = lines.findIndex((l) => l.trim() === rule);
    if (idx < 0) throw new Error(`missing ${rule} rule in _headers`);
    for (let i = idx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^[^\s/]/.test(line) && !line.startsWith(' ')) break;
      if (line.includes('Content-Security-Policy')) return line;
    }
    throw new Error(`no CSP under ${rule} in _headers`);
  }

  it("contains manifest-src 'self' blob: in /embed/* CSP directive", () => {
    const csp = cspForRule('/embed/*');
    expect(csp).toContain("manifest-src 'self' blob:;");
  });

  it("contains manifest-src 'self' blob: in /* CSP directive", () => {
    const csp = cspForRule('/*');
    expect(csp).toContain("manifest-src 'self' blob:;");
  });
});

