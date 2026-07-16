/**
 * Per-tenant brand-asset scoping (Stay by City Focus).
 *
 * Repo-shipped artwork in TENANT_OVERRIDES[slug] must apply ONLY to that slug:
 * the devstaybycf branded subdomain gets its logo/favicon, while every other
 * tenant (incl. the atlastays.com marketplace apex) keeps API values or the
 * brand-neutral defaults.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTenantBranding } from './tenantBranding';
import type { TenantInfo } from './tenantContext';

const STAYBYCF_LOGO = '/images/stay-bycityfocus-logo.png';
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

  it('applies the Stay by City Focus logo + favicon for the devstaybycf slug only', () => {
    applyTenantBranding(makeTenant({ slug: 'devstaybycf', name: 'Stay by City Focus' }));

    expect(faviconHref()).toBe(STAYBYCF_LOGO);
    expect(document.documentElement.style.getPropertyValue('--brand-logo-url')).toContain(
      'stay-bycityfocus',
    );
  });

  it('leaves other tenants on the neutral static favicon with no logo var', () => {
    applyTenantBranding(makeTenant({ slug: 'some-other-tenant' }));

    expect(faviconHref()).toBe(STATIC_FAVICON);
    expect(document.documentElement.style.getPropertyValue('--brand-logo-url')).toBe('');
  });

  it('leaves the atlas marketplace tenant untouched by the devstaybycf artwork', () => {
    applyTenantBranding(makeTenant({ slug: 'atlas', name: 'Atlastays', isCustomDomain: false }));

    expect(faviconHref()).toBe(STATIC_FAVICON);
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
