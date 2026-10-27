import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/api/client', () => ({ buildApiUrl: (p: string) => `https://api.test${p}` }));
vi.mock('@/components/SEO', () => ({ default: () => null }));
vi.mock('@/components/map/MultiPinMap', () => ({ default: () => null }));
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
    tenantSlug: 'atlas',
    tenantName: 'Atlas Homestays',
    title: 'Comfort Villa',
    displayName: 'Comfort Villa',
    city: 'Goa',
    pricePerNight: 5000,
    maxGuests: 4,
    slug: '101',
    rating: 4.9,
    reviewCount: 20,
    amenityCodes: ['swimming_pool', 'wifi'],
  },
  {
    id: 202,
    tenantSlug: 'atlas',
    tenantName: 'Atlas Homestays',
    title: 'Budget Studio',
    displayName: 'Budget Studio',
    city: 'Goa',
    pricePerNight: 2000,
    maxGuests: 2,
    slug: '202',
    rating: 4.2,
    reviewCount: 5,
    amenityCodes: ['wifi'],
  },
  {
    id: 303,
    tenantSlug: 'atlas',
    tenantName: 'Atlas Homestays',
    title: 'Luxury Suite',
    displayName: 'Luxury Suite',
    city: 'Goa',
    pricePerNight: 9000,
    maxGuests: 6,
    slug: '303',
    rating: 4.7,
    reviewCount: 15,
    amenityCodes: ['swimming_pool', 'beach_access'],
  },
];

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/marketplace/properties')) {
        return { ok: true, json: async () => [] } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({ items: mockListings, total: mockListings.length, page: 1, pageSize: 20 }),
      } as unknown as Response;
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TASK-1039950 — Filter pills synced with URL search parameters', () => {
  it('initializes active category and amenity pills from URL query params', async () => {
    render(
      <MemoryRouter initialEntries={['/?category=homes&amenity=Pool']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );
    await settle();

    // Homes category button should be active (bg-black)
    const homesBtn = screen.getByTestId('marketplace-filter-homes');
    expect(homesBtn.className).toContain('bg-black');

    // Pool amenity pill should be active (bg-black)
    const poolPill = screen.getByTestId('marketplace-amenity-pool');
    expect(poolPill.className).toContain('bg-black');
  });

  it('clicking a category filter pill updates active state', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );
    await settle();

    const roomsBtn = screen.getByTestId('marketplace-filter-rooms');
    fireEvent.click(roomsBtn);
    await settle();

    expect(roomsBtn.className).toContain('bg-black');
  });

  it('clicking an amenity filter pill toggles selection', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );
    await settle();

    const poolPill = screen.getByTestId('marketplace-amenity-pool');
    fireEvent.click(poolPill);
    await settle();

    expect(poolPill.className).toContain('bg-black');

    // Clicking again deselects it
    fireEvent.click(poolPill);
    await settle();
    expect(poolPill.className).not.toContain('bg-black');
  });
});

describe('TASK-1039952 — Sort dropdown on Marketplace Homepage', () => {
  it('renders sort control with all 4 required options', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );
    await settle();

    const sortSelect = screen.getByTestId('marketplace-sort-select') as HTMLSelectElement;
    expect(sortSelect).toBeInTheDocument();
    expect(sortSelect.value).toBe('recommended');

    const options = Array.from(sortSelect.options).map((o) => o.textContent);
    expect(options).toEqual([
      'Recommended',
      'Price: Low to High',
      'Price: High to Low',
      'Rating: High to Low',
    ]);
  });

  it('sorts listings by Price: Low to High when selected', async () => {
    render(
      <MemoryRouter initialEntries={['/?sort=price_asc']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );
    await settle();

    const sortSelect = screen.getByTestId('marketplace-sort-select') as HTMLSelectElement;
    expect(sortSelect.value).toBe('price_asc');

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    // Budget Studio (2000), Comfort Villa (5000), Luxury Suite (9000)
    expect(headings).toEqual(['Budget Studio', 'Comfort Villa', 'Luxury Suite']);
  });

  it('sorts listings by Price: High to Low when selected', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );
    await settle();

    const sortSelect = screen.getByTestId('marketplace-sort-select');
    fireEvent.change(sortSelect, { target: { value: 'price_desc' } });
    await settle();

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    // Luxury Suite (9000), Comfort Villa (5000), Budget Studio (2000)
    expect(headings).toEqual(['Luxury Suite', 'Comfort Villa', 'Budget Studio']);
  });

  it('sorts listings by Rating: High to Low when selected', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );
    await settle();

    const sortSelect = screen.getByTestId('marketplace-sort-select');
    fireEvent.change(sortSelect, { target: { value: 'rating_desc' } });
    await settle();

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    // Comfort Villa (4.9), Luxury Suite (4.7), Budget Studio (4.2)
    expect(headings).toEqual(['Comfort Villa', 'Luxury Suite', 'Budget Studio']);
  });
});

describe('TASK-1039951 — Price range filtering qualifies positive rates only', () => {
  it('excludes listings with price 0 or unconfigured rates when price filter is applied', async () => {
    const listingsWithZeroPrice = [
      ...mockListings,
      {
        id: 404,
        tenantSlug: 'atlas',
        tenantName: 'Atlas Homestays',
        title: 'Unconfigured Listing',
        displayName: 'Unconfigured Listing',
        city: 'Goa',
        pricePerNight: 0,
        maxGuests: 2,
        slug: '404',
        rating: 4.5,
        reviewCount: 3,
        amenityCodes: ['wifi'],
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes('/marketplace/properties')) {
          return { ok: true, json: async () => [] } as unknown as Response;
        }
        return {
          ok: true,
          json: async () => ({
            items: listingsWithZeroPrice,
            total: listingsWithZeroPrice.length,
            page: 1,
            pageSize: 20,
          }),
        } as unknown as Response;
      }),
    );

    render(
      <MemoryRouter initialEntries={['/']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );
    await settle();

    // Before price filter, Unconfigured Listing is loaded
    expect(screen.getByText('Unconfigured Listing')).toBeInTheDocument();

    // Apply max price 6000: only positive price listings <= 6000 should remain (Budget Studio and Comfort Villa).
    // The listing with price 0 must be excluded.
    const maxPriceInput = screen.getByLabelText('Max price');
    fireEvent.change(maxPriceInput, { target: { value: '6000' } });
    await settle();

    expect(screen.queryByText('Unconfigured Listing')).not.toBeInTheDocument();
    expect(screen.getByText('Budget Studio')).toBeInTheDocument();
    expect(screen.getByText('Comfort Villa')).toBeInTheDocument();
    expect(screen.queryByText('Luxury Suite')).not.toBeInTheDocument();
  });
});
