import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settle } from '@/test/settle';
import MarketplaceHomepage from './MarketplaceHomepage';

vi.mock('@/components/map/MultiPinMap', () => ({
  default: ({
    pins,
    onBoundsChanged,
    initialBounds,
  }: {
    pins: Array<{ id: string }>;
    onBoundsChanged?: (b: { swLat: number; swLng: number; neLat: number; neLng: number }) => void;
    initialBounds?: { swLat: number; swLng: number; neLat: number; neLng: number } | null;
  }) => (
    <div data-testid="mock-multipin-map" data-pins={pins.length} data-has-initial-bounds={Boolean(initialBounds)}>
      <button
        type="button"
        data-testid="mock-pan-map"
        onClick={() => onBoundsChanged?.({ swLat: 15.1, swLng: 73.7, neLat: 15.6, neLng: 74.1 })}
      >
        Pan
      </button>
    </div>
  ),
}));

vi.mock('@/components/ReviewSummary', () => ({
  default: () => null,
}));

const sampleListings = [
  {
    id: 1,
    tenantSlug: 'palm-bnb',
    tenantName: 'Palm B&B',
    title: 'Palm B&B Deluxe Room',
    city: 'Goa',
    pricePerNight: 3200,
    maxGuests: 2,
    slug: '1',
    accommodationType: 'BnB',
    hasFreeCancellation: true,
    freeCancellationDeadlineUtc: '2026-12-10T00:00:00Z',
    hasBreakfastIncluded: true,
    mealPlanCodes: ['CP'],
  },
  {
    id: 2,
    tenantSlug: 'zostel-goa',
    tenantName: 'Drift Hostel',
    title: '6-Bed Mixed Dorm',
    city: 'Goa',
    pricePerNight: 800,
    maxGuests: 1,
    slug: '2',
    accommodationType: 'HostelDorm',
    hasFreeCancellation: false,
    hasBreakfastIncluded: false,
    hasBreakfastOptional: true,
    mealPlanCodes: ['EP', 'CP'],
  },
  {
    id: 3,
    tenantSlug: 'bay-hotel',
    tenantName: 'Bay Hotel',
    title: 'Bay Boutique Hotel Suite',
    city: 'Kochi',
    pricePerNight: 5500,
    maxGuests: 3,
    slug: '3',
    accommodationType: 'Hotel',
    hasFreeCancellation: true,
    hasBreakfastIncluded: false,
    mealPlanCodes: ['EP'],
  },
];

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/marketplace/properties')) {
        return {
          ok: true,
          json: async () => [
            {
              propertyId: 10,
              listingId: 1,
              tenantSlug: 'palm-bnb',
              propertyName: 'Palm B&B',
              listingName: 'Palm B&B Deluxe Room',
              latitude: 15.4,
              longitude: 73.8,
            },
          ],
        } as unknown as Response;
      }
      let filtered = sampleListings;
      if (u.includes('freeCancellation=true')) filtered = filtered.filter((x) => x.hasFreeCancellation);
      if (u.includes('mealPlan=breakfast')) filtered = filtered.filter((x) => x.hasBreakfastIncluded || x.hasBreakfastOptional);
      if (u.includes('category=bnb')) filtered = filtered.filter((x) => x.accommodationType === 'BnB');
      if (u.includes('category=hostels')) filtered = filtered.filter((x) => x.accommodationType === 'HostelDorm');
      return {
        ok: true,
        json: async () => ({ items: filtered, total: filtered.length, page: 1, pageSize: 20 }),
      } as unknown as Response;
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('MKT-048..051: Marketplace map search, free cancellation, breakfast, and 5 YCS segments', () => {
  it('renders all 5 YCS category tabs and forwards category slugs to /marketplace/listings', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );

    await settle();
    expect(screen.getByText('Palm B&B Deluxe Room')).toBeInTheDocument();

    for (const id of ['all', 'homestays', 'villas', 'bnb', 'hotels', 'hostels']) {
      expect(screen.getByTestId(`marketplace-filter-${id}`)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByTestId('marketplace-filter-bnb'));
    await settle();
    expect(screen.getByText('Palm B&B Deluxe Room')).toBeInTheDocument();
    expect(screen.queryByText('6-Bed Mixed Dorm')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('marketplace-filter-hostels'));
    await settle();
    expect(screen.getByText('6-Bed Mixed Dorm')).toBeInTheDocument();
    expect(screen.queryByText('Palm B&B Deluxe Room')).not.toBeInTheDocument();
  });

  it('toggles Free cancellation and Breakfast included pills and renders badges on matching cards', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );

    await settle();
    expect(screen.getByText('Palm B&B Deluxe Room')).toBeInTheDocument();

    expect(screen.getAllByTestId('marketplace-free-cancellation-badge').length).toBeGreaterThan(0);
    expect(screen.getByText(/Free cancellation until/i)).toBeInTheDocument();
    expect(screen.getByText(/Free cancellation available/i)).toBeInTheDocument();
    expect(screen.getByText(/☕ Breakfast included/)).toBeInTheDocument();
    expect(screen.getByText(/☕ Breakfast option available/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('marketplace-filter-free-cancellation'));
    await settle();
    expect(screen.queryByText('6-Bed Mixed Dorm')).not.toBeInTheDocument();
    expect(screen.getByText('Palm B&B Deluxe Room')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('marketplace-filter-breakfast'));
    await settle();
    expect(screen.queryByText('Bay Boutique Hotel Suite')).not.toBeInTheDocument();
    expect(screen.getByText('Palm B&B Deluxe Room')).toBeInTheDocument();
  });

  it('shows Search this area after panning map and sends swLat/swLng/neLat/neLng to API', async () => {
    const fetchMock = vi.mocked(fetch);
    render(
      <MemoryRouter initialEntries={['/']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );

    await settle();
    expect(screen.getByTestId('marketplace-map-toggle')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('marketplace-map-toggle'));
    fireEvent.click(screen.getByTestId('mock-pan-map'));

    const searchAreaBtn = screen.getByTestId('marketplace-search-this-area');
    fireEvent.click(searchAreaBtn);

    await settle();
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/marketplace/listings') && u.includes('swLat=15.1') && u.includes('neLng=74.1'))).toBe(true);
    expect(urls.some((u) => u.includes('/marketplace/properties') && u.includes('swLat=15.1') && u.includes('neLng=74.1'))).toBe(true);
  });
});
