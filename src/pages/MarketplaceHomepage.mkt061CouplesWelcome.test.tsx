import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settle } from '@/test/settle';
import MarketplaceHomepage from './MarketplaceHomepage';

vi.mock('@/components/map/MultiPinMap', () => ({
  default: () => null,
}));

vi.mock('@/components/ReviewSummary', () => ({
  default: () => null,
}));

const sampleListings = [
  {
    id: 201,
    tenantSlug: 'goa-couples',
    tenantName: 'Goa Couples Villa',
    name: 'Goa Couples Welcome Villa',
    title: 'Goa Couples Welcome Villa',
    city: 'Goa',
    pricePerNight: 4200,
    maxGuests: 2,
    slug: '201',
    couplesWelcome: true,
    localIdAccepted: true,
  },
  {
    id: 202,
    tenantSlug: 'unset-stay',
    tenantName: 'Unset Policy Stay',
    name: 'Coorg Unset Policy Cottage',
    title: 'Coorg Unset Policy Cottage',
    city: 'Coorg',
    pricePerNight: 3000,
    maxGuests: 4,
    slug: '202',
    couplesWelcome: null,
    localIdAccepted: null,
  },
  {
    id: 203,
    tenantSlug: 'explicit-false',
    tenantName: 'Family Only Stay',
    name: 'Ooty Family Bungalow',
    title: 'Ooty Family Bungalow',
    city: 'Ooty',
    pricePerNight: 3500,
    maxGuests: 4,
    slug: '203',
    couplesWelcome: false,
    localIdAccepted: false,
  },
];

describe('MarketplaceHomepage — MKT-061 Couples welcome & Local ID badges/filter', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/marketplace/listings')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: sampleListings,
              total: sampleListings.length,
              totalCount: sampleListings.length,
              page: 1,
              pageSize: 24,
              hasMore: false,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (url.includes('/marketplace/price-distribution')) {
        return Promise.resolve(
          new Response(JSON.stringify({ buckets: [], minPrice: 0, maxPrice: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchSpy.mockReset();
  });

  it('renders Couples welcome and Local ID accepted badges ONLY for explicitly opted-in listings', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );
    await settle();

    expect(screen.getAllByTestId('marketplace-card')).toHaveLength(3);

    const couplesBadges = screen.getAllByTestId('marketplace-couples-welcome-badge');
    const localIdBadges = screen.getAllByTestId('marketplace-local-id-badge');
    expect(couplesBadges).toHaveLength(1);
    expect(couplesBadges[0]).toHaveTextContent('Couples welcome');
    expect(localIdBadges).toHaveLength(1);
    expect(localIdBadges[0]).toHaveTextContent('Local ID accepted');
  });

  it('toggles Couples welcome filter pill, sends ?couplesWelcome=true, and excludes unset/false listings', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );
    await settle();

    const pill = screen.getByTestId('marketplace-filter-couples-welcome');
    expect(pill).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(pill);
    await settle();

    expect(pill).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId('marketplace-card')).toHaveLength(1);
    expect(screen.getAllByTestId('marketplace-couples-welcome-badge')).toHaveLength(1);

    const listingUrls = fetchSpy.mock.calls
      .map(([arg]) => (typeof arg === 'string' ? arg : String(arg)))
      .filter((u) => u.includes('/marketplace/listings'));
    expect(listingUrls.some((u) => u.includes('couplesWelcome=true'))).toBe(true);
  });

  it('hydrates ?couplesWelcome=true from initial URL', async () => {
    render(
      <MemoryRouter initialEntries={['/?couplesWelcome=true']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );
    await settle();

    const pill = screen.getByTestId('marketplace-filter-couples-welcome');
    expect(pill).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId('marketplace-card')).toHaveLength(1);
    expect(screen.getAllByTestId('marketplace-couples-welcome-badge')).toHaveLength(1);
  });
});
