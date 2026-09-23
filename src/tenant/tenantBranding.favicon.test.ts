import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTenantBranding } from './tenantBranding';
import type { TenantInfo } from './tenantContext';

/**
 * TASK-102423 — tenant direct site must show the host logo favicon AND touch icon,
 * never the Atlas default. The tab favicon half already shipped; this pins the
 * mobile homescreen (apple-touch-icon) half.
 */
function makeTenant(overrides: Partial<TenantInfo> & Pick<TenantInfo, 'slug'>): TenantInfo {
  return {
    name: 'Test Tenant',
    showAtlasFooterCredit: false,
    isCustomDomain: true,
    ...overrides,
  };
}

describe('applyTenantBranding — TASK-102423 host touch icon', () => {
  beforeEach(() => {
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.href = '/favicon.ico';
    document.head.appendChild(icon);
    const touch = document.createElement('link');
    touch.rel = 'apple-touch-icon';
    touch.href = '/icons/logo192.png';
    document.head.appendChild(touch);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  });

  afterEach(() => {
    document.head.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']").forEach((el) => el.remove());
    vi.unstubAllGlobals();
  });

  it("swaps apple-touch-icon to the tenant logo when one is configured", () => {
    applyTenantBranding(
      makeTenant({ slug: 'villa-shanti', logoUrl: 'https://cdn.example.com/villa-shanti-logo.png' }),
    );
    expect(
      document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.getAttribute('href'),
    ).toBe('https://cdn.example.com/villa-shanti-logo.png');
  });

  it('swaps the tab favicon from the tenant faviconUrl (existing half, pinned)', () => {
    applyTenantBranding(
      makeTenant({ slug: 'villa-shanti', faviconUrl: 'https://cdn.example.com/favicon.ico' }),
    );
    expect(document.querySelector<HTMLLinkElement>("link[rel~='icon']")?.getAttribute('href')).toBe(
      'https://cdn.example.com/favicon.ico',
    );
  });

  it('leaves the Atlas default touch icon when the tenant has no logo', () => {
    applyTenantBranding(makeTenant({ slug: 'brand-new-tenant' }));
    expect(
      document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.getAttribute('href'),
    ).toBe('/icons/logo192.png');
  });
});
