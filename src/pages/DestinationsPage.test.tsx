// MKT-034 — the /destinations city directory: every city guide is listed with a link to it, stay counts come from the
// cross-tenant marketplace feed using each guide's own keyword rule (a city with none shows no count, never "0 stays"),
// a failed load leaves the links working, and a white-label tenant domain is sent home.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/api/client', () => ({ buildApiUrl: (p: string) => `https://api.test${p}` }));
vi.mock('@/components/SEO', () => ({ default: () => null }));

const tenantMocks = vi.hoisted(() => ({ hideBranding: false, marketplace: true }));

vi.mock('@/tenant/tenantContext', () => ({ getTenantContext: () => ({ slug: 'atlas' }) }));
vi.mock('@/tenant/tenantOverrides', () => ({
  getTenantOverrides: () => ({}),
  shouldHideAtlasBranding: () => tenantMocks.hideBranding,
}));
vi.mock('@/tenant/tenantResolver', () => ({
  isMarketplaceMode: () => tenantMocks.marketplace,
  isAtlastaysMarketplaceSurface: () => tenantMocks.marketplace,
}));

import DestinationsPage, { countStaysByCity } from './DestinationsPage';
import { CITY_LANDING_SLUGS } from '@/content/cities/cityLandingSlugs';
import { settle } from '../test/settle';

function stubListings(items: unknown[], opts: { ok?: boolean } = {}) {
  const fetchMock = vi.fn(async () => {
    if (opts.ok === false) return { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
    return { ok: true, json: async () => ({ items, total: items.length, page: 1, pageSize: 50 }) } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/destinations']}>
      <Routes>
        <Route path="/destinations" element={<DestinationsPage />} />
        <Route path="/" element={<div data-testid="home-probe">home</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  tenantMocks.hideBranding = false;
  tenantMocks.marketplace = true;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MKT-034: /destinations city directory', () => {
  it('lists every city guide with a link to /homestays-in-{slug}', async () => {
    stubListings([]);
    renderPage();
    await settle();

    expect(screen.getByRole('heading', { level: 1, name: 'Explore destinations' })).toBeInTheDocument();
    for (const slug of CITY_LANDING_SLUGS) {
      expect(screen.getByTestId(`destination-card-${slug}`)).toHaveAttribute('href', `/homestays-in-${slug}`);
    }
  });

  it('shows a stay count per city from the marketplace feed, singular and plural, and none for an empty city', async () => {
    stubListings([
      { id: 1, city: 'Panaji', title: 'Beach house' },
      { id: 2, city: 'Goa', title: 'Villa' },
      { id: 3, city: 'Madikeri', title: 'Estate stay' },
      { id: 4, city: 'Nowhere', title: 'Unmatched' },
    ]);
    renderPage();
    await settle();

    expect(screen.getByTestId('destination-count-goa')).toHaveTextContent('2 stays');
    expect(screen.getByTestId('destination-count-coorg')).toHaveTextContent('1 stay');
    expect(screen.queryByTestId('destination-count-manali')).not.toBeInTheDocument();
    expect(screen.queryByText(/\b0 stays\b/)).not.toBeInTheDocument();
  });

  it('asks only the existing /marketplace/listings feed for the counts', async () => {
    const fetchMock = stubListings([]);
    renderPage();
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('https://api.test/marketplace/listings?');
  });

  it('still lists every city, without counts, when the feed fails', async () => {
    stubListings([], { ok: false });
    renderPage();
    await settle();

    for (const slug of CITY_LANDING_SLUGS) {
      expect(screen.getByTestId(`destination-card-${slug}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`destination-count-${slug}`)).not.toBeInTheDocument();
    }
  });

  it('makes no marketplace request off the marketplace surface (a tenant site has no cross-tenant counts to show)', async () => {
    tenantMocks.marketplace = false;
    const fetchMock = stubListings([]);
    renderPage();
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('destination-card-goa')).toBeInTheDocument();
  });

  it('sends a white-label tenant domain home instead of showing Atlas city guides', async () => {
    tenantMocks.hideBranding = true;
    stubListings([]);
    renderPage();
    await settle();

    expect(screen.getByTestId('home-probe')).toBeInTheDocument();
    expect(screen.queryByTestId('destinations-page')).not.toBeInTheDocument();
  });
});

describe('MKT-034: countStaysByCity', () => {
  it('counts with each guide\'s keyword rule and leaves out cities with no stay', () => {
    expect(countStaysByCity([{ city: 'Calangute', title: 'x' }, { city: 'Old Manali', title: 'y' }, { city: null, title: null }])).toEqual({
      goa: 1,
      manali: 1,
    });
    expect(countStaysByCity([])).toEqual({});
  });
});
