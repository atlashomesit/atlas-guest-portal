/** @vitest-environment jsdom */

/**
 * TASK-10299421 + TASK-10299422 (guest-portal part): "Powered by Atlas" on every published host site.
 * The link carries a tracking tag and the tenant slug only. Never a guest, booking or price value.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { TenantInfo } from '@/tenant/tenantContext';
import { buildPoweredByAtlasUrl, sanitizePoweredBySlug } from '@/tenant/poweredByAtlas';
import { settle } from '../test/settle';

const tenantCtxMock = vi.hoisted(() => ({ getTenantContext: vi.fn() }));
vi.mock('@/tenant/tenantContext', () => ({
  getTenantContext: (...args: unknown[]) => tenantCtxMock.getTenantContext(...args),
}));
vi.mock('@/runtime-config', () => ({
  getApiBaseUrl: () => 'https://api.example.test',
  hasRuntimeConfig: () => false,
  getRuntimeConfig: () => ({}),
}));
vi.mock('./SEO', () => ({ default: () => null }));

const hostTenant = (over: Partial<TenantInfo> = {}): TenantInfo =>
  ({ name: 'Sunrise Villas', slug: 'sunrise-villas', ...over }) as TenantInfo;

const customDomainTenant = hostTenant({
  legalContactPack: {
    legalName: 'Sunrise Villas Hospitality Pvt Ltd',
    displayName: 'Sunrise Villas',
    contactEmail: 'grievance@sunrisevillas.com',
    showAtlasFooterCredit: false,
    isCustomDomain: true,
  },
} as Partial<TenantInfo>);

const renderFooterAt = async (path: string) => {
  const { default: Footer } = await import('./commonComponents/footer/Footer');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Footer />
    </MemoryRouter>,
  );
};

function expectTaggedLink(link: HTMLElement, medium: string, slug: string) {
  const url = new URL(link.getAttribute('href') ?? '');
  expect(url.origin + url.pathname).toBe('https://atlaspms.in/');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    utm_source: 'powered-by',
    utm_medium: medium,
    utm_campaign: slug,
  });
  expect(link).toHaveAttribute('target', '_blank');
  expect(link.getAttribute('rel')).toContain('noopener');
  expect(link).toHaveTextContent('Powered by Atlas');
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('buildPoweredByAtlasUrl', () => {
  it('carries the tag and the slug only', () => {
    expect(buildPoweredByAtlasUrl('sunrise-villas', 'tenant-site')).toBe(
      'https://atlaspms.in/?utm_source=powered-by&utm_medium=tenant-site&utm_campaign=sunrise-villas',
    );
  });

  it('drops anything that is not a plain subdomain label, so no guest, booking or price value can ride in the URL', () => {
    const bad = ['a@b.com', 'ATL-4242 2026-11-02', '9999.50', 'x&bookingId=1', '', null, undefined];
    for (const value of bad) {
      expect(sanitizePoweredBySlug(value)).toBeNull();
      const url = buildPoweredByAtlasUrl(value, 'checkin');
      expect(url).not.toMatch(/booking|guest|price|amount|@|\s/i);
      expect(new URL(url).searchParams.get('utm_campaign')).toBeNull();
    }
  });
});

describe('footer of a published host booking site', () => {
  it('shows the tagged link on an Atlas-subdomain tenant site', async () => {
    tenantCtxMock.getTenantContext.mockReturnValue(hostTenant());
    await renderFooterAt('/');
    expectTaggedLink(screen.getByTestId('powered-by-atlas'), 'tenant-site', 'sunrise-villas');
  });

  it('shows it on a custom-domain site too, next to the merchant-of-record disclosure', async () => {
    tenantCtxMock.getTenantContext.mockReturnValue(customDomainTenant);
    await renderFooterAt('/stays');
    expectTaggedLink(screen.getByTestId('powered-by-atlas'), 'tenant-site', 'sunrise-villas');
    expect(screen.getByTestId('mor-disclosure')).toBeInTheDocument();
  });

  it('never puts a guest, booking or price value in the URL, whatever the page query holds', async () => {
    tenantCtxMock.getTenantContext.mockReturnValue(hostTenant());
    await renderFooterAt('/stays?guest=Priya&bookingId=42&price=5000&email=a@b.com');
    const href = screen.getByTestId('powered-by-atlas').getAttribute('href') ?? '';
    expect(href).not.toMatch(/Priya|bookingId|42|5000|a@b\.com/);
  });

  it('is not added to the Atlas marketplace itself', async () => {
    tenantCtxMock.getTenantContext.mockReturnValue(hostTenant({ slug: 'atlas', name: 'Atlas' }));
    await renderFooterAt('/');
    expect(screen.queryByTestId('powered-by-atlas')).not.toBeInTheDocument();
  });

  it('the check-in route has its own line, so the footer adds none there', async () => {
    tenantCtxMock.getTenantContext.mockReturnValue(hostTenant());
    await renderFooterAt('/check-in/ATL-1');
    expect(screen.queryByTestId('powered-by-atlas')).not.toBeInTheDocument();
  });
});

describe('embed widget', () => {
  it('links "Powered by Atlas" with utm_medium=embed and the tenant slug', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              tenantId: 1,
              tenantSlug: 'sunrise-villas',
              tenantName: 'Sunrise Villas',
              isLiveEligible: true,
              publishedListingsCount: 1,
              listings: [
                { id: 1, name: 'Studio', propertyId: 1, propertyName: 'Beach House', maxGuests: 4, baseNightlyRate: 5000 },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const { default: EmbedPage } = await import('../pages/EmbedPage');
    render(
      <MemoryRouter initialEntries={['/embed/demo']}>
        <Routes>
          <Route path="/embed/:embedKey" element={<EmbedPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await settle();
    expectTaggedLink(screen.getByTestId('powered-by-atlas'), 'embed', 'sunrise-villas');
  });
});

describe('guest check-in page (TASK-10299422 portal part)', () => {
  beforeEach(() => {
    tenantCtxMock.getTenantContext.mockReturnValue(hostTenant());
  });

  it('shows one line tagged utm_medium=checkin with the tenant slug only', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              bookingRef: 'ATL-4242',
              listingName: 'Lake View Loft',
              propertyAddress: 'Udaipur',
              checkinDate: '2026-11-02',
              checkoutDate: '2026-11-04',
              guestName: 'Priya Sharma',
              guestCount: 1,
              houseRulesText: '',
              idUploadRequired: false,
              houseRulesSignedAt: '2026-10-20T10:00:00Z',
              guestHasDeliverablePhone: true,
              guestHasUsableEmail: true,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    const { default: SelfCheckIn } = await import('../pages/SelfCheckIn');
    render(
      <MemoryRouter initialEntries={['/check-in/ATL-4242?t=tok-123']}>
        <Routes>
          <Route path="/check-in/:bookingRef" element={<SelfCheckIn />} />
        </Routes>
      </MemoryRouter>,
    );
    await settle();
    const link = screen.getByTestId('powered-by-atlas');
    expectTaggedLink(link, 'checkin', 'sunrise-villas');
    expect(link.getAttribute('href')).not.toMatch(/ATL-4242|tok-123|Priya/);
  });
});
