import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/api/client', () => ({ buildApiUrl: (p: string) => `https://api.test${p}` }));
vi.mock('@/components/SEO', () => ({ default: () => null }));
vi.mock('@/components/map/MultiPinMap', () => ({
  default: ({ pins }: { pins: { id: string; title: string }[] }) => (
    <div data-testid="mock-multi-pin-map">{pins.map((p) => p.title).join(', ')}</div>
  ),
}));
vi.mock('@/components/marketplace/airbnbSearch/AirbnbSearchBar', () => ({ default: () => null }));
vi.mock('@/components/ReviewSummary', () => ({ default: () => null }));
vi.mock('@/components/OwnerShareBadge', () => ({ default: () => null }));
vi.mock('@/components/ui/OptimizedImage', () => ({ default: () => null }));
vi.mock('@/components/apartments/SkeletonCard', () => ({ default: () => null }));
vi.mock('@/utils/guestHistory', () => ({ getFavoriteIds: () => [], toggleFavorite: () => {} }));
vi.mock('@/tenant/paymentRail', () => ({ hasOnlinePaymentRail: () => false }));
vi.mock('@/utils/marketplaceListingCover', () => ({
  enrichMarketplaceCoverItems: async <T,>(items: T[]) => items,
}));

import MarketplaceHomepage from './MarketplaceHomepage';
import { settle } from '../test/settle';

const mockListings = [
  {
    id: 101,
    tenantSlug: 'goa-stays',
    tenantName: 'Goa Stays',
    title: 'Goa Beach Villa',
    city: 'Goa',
    pricePerNight: 3500,
    maxGuests: 4,
    slug: '101',
    rating: 4.8,
    reviewCount: 12,
    amenityCodes: ['swimming_pool', 'wifi'],
  },
  {
    id: 202,
    tenantSlug: 'hyd-homes',
    tenantName: 'Hyd Homes',
    title: 'Hyderabad Penthouse',
    city: 'Hyderabad',
    pricePerNight: 8500,
    maxGuests: 6,
    slug: '202',
    rating: 3.6,
    reviewCount: 5,
    amenityCodes: ['ac', 'wifi'],
  },
];

const mockProperties = [
  {
    propertyId: 10,
    listingId: 101,
    tenantSlug: 'goa-stays',
    propertyName: 'Goa Beach Villa',
    propertyAddress: 'Calangute, Goa',
    listingName: 'Goa Beach Villa',
    latitude: 15.5439,
    longitude: 73.7553,
  },
  {
    propertyId: 20,
    listingId: 202,
    tenantSlug: 'hyd-homes',
    propertyName: 'Hyderabad Penthouse',
    propertyAddress: 'Jubilee Hills, Hyderabad',
    listingName: 'Hyderabad Penthouse',
    latitude: 17.4319,
    longitude: 78.4071,
  },
];

let requestedUrls: string[] = [];

beforeEach(() => {
  requestedUrls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      requestedUrls.push(u);
      const parsed = new URL(u);
      if (u.includes('/marketplace/properties')) {
        const loc = parsed.searchParams.get('location')?.toLowerCase();
        const filteredProps = loc
          ? mockProperties.filter((p) =>
              `${p.propertyName} ${p.propertyAddress}`.toLowerCase().includes(loc),
            )
          : mockProperties;
        return { ok: true, json: async () => filteredProps } as unknown as Response;
      }
      const city = parsed.searchParams.get('city')?.toLowerCase();
      const maxPrice = parsed.searchParams.get('maxPrice');
      let items = [...mockListings];
      if (city) {
        items = items.filter((i) => (i.city ?? '').toLowerCase().includes(city));
      }
      if (maxPrice != null) {
        items = items.filter((i) => i.pricePerNight <= Number(maxPrice));
      }
      return {
        ok: true,
        json: async () => ({ items, total: items.length, page: 1, pageSize: 20 }),
      } as unknown as Response;
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MKT-020 marketplace map pin filtering & TASK-10298776 < 4★ rating guard', () => {
  it('updates Map (N) pin count when filtering by city or price and forwards location/date params to /marketplace/properties', async () => {
    render(
      <MemoryRouter initialEntries={['/?checkIn=2026-12-10&checkOut=2026-12-12']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );

    await settle();
    const mapBtn = screen.getByTestId('marketplace-map-toggle');
    expect(mapBtn).toHaveTextContent('Map (2)');

    // Filtering by max price narrows both grid and Map (N) count to 1
    fireEvent.change(screen.getByLabelText('Max price'), { target: { value: '5000' } });
    await settle();
    expect(screen.getByTestId('marketplace-map-toggle')).toHaveTextContent('Map (1)');

    // Reset price and filter by city "Goa"
    fireEvent.click(screen.getByRole('button', { name: /clear price/i }));
    await settle();
    expect(screen.getByTestId('marketplace-map-toggle')).toHaveTextContent('Map (2)');

    fireEvent.change(screen.getByTestId('marketplace-search'), { target: { value: 'Goa' } });
    await settle();
    expect(screen.getByTestId('marketplace-map-toggle')).toHaveTextContent('Map (1)');

    const propCalls = requestedUrls.filter((u) => u.includes('/marketplace/properties'));
    expect(propCalls.some((u) => u.includes('location=Goa') && u.includes('checkIn=2026-12-10'))).toBe(
      true,
    );
  });

  it('suppresses card star ratings below 4.0 while rendering ratings >= 4.0 (TASK-10298776)', async () => {
    render(
      <MemoryRouter>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );

    await settle();
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.queryByText('3.6')).not.toBeInTheDocument();
  });

  it('filters grid cleanly using amenity filter pills via amenityCodes (TASK-10298932)', async () => {
    render(
      <MemoryRouter>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );

    await settle();
    expect(screen.getByText('Goa Beach Villa')).toBeInTheDocument();
    expect(screen.getByText('Hyderabad Penthouse')).toBeInTheDocument();

    // Click 'Pool' pill
    fireEvent.click(screen.getByTestId('marketplace-amenity-pool'));
    await settle();

    // Only Goa Beach Villa (amenityCodes: ['swimming_pool']) should be visible
    expect(screen.getByText('Goa Beach Villa')).toBeInTheDocument();
    expect(screen.queryByText('Hyderabad Penthouse')).not.toBeInTheDocument();

    // Clear amenity filter restores all
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    await settle();
    expect(screen.getByText('Goa Beach Villa')).toBeInTheDocument();
    expect(screen.getByText('Hyderabad Penthouse')).toBeInTheDocument();
  });
});
