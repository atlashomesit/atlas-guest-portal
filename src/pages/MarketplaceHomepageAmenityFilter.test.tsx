// MKT-026 - the amenity pill must reach GET /marketplace/listings as `amenities=` (so the server
// filters before pagination and page 2+ is filtered too), and the title/text guess must only run
// for an older API or a pill with no server code (Pet Friendly).
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
import { serverAmenityCodesFor } from '@/utils/amenityFilters';
import { settle } from '../test/settle';

function listing(id: number, title: string, amenityCodes?: string[]) {
  return {
    id, tenantSlug: 'atlas', tenantName: 'Atlas', title, city: 'Testville', pricePerNight: 5000,
    maxGuests: 2, slug: String(id), hasVerifiedPhotos: true, ...(amenityCodes ? { amenityCodes } : {}),
  };
}

let requests: string[] = [];
let respond: (u: URL) => unknown;

beforeEach(() => {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/marketplace/properties')) return { ok: true, json: async () => [] } as unknown as Response;
      requests.push(u);
      return { ok: true, json: async () => respond(new URL(u)) } as unknown as Response;
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <MarketplaceHomepage />
    </MemoryRouter>,
  );

describe('MKT-026 marketplace amenity filter is forwarded to the API', () => {
  it('maps pills to master codes; Pet Friendly stays client-only', () => {
    expect(serverAmenityCodesFor('Pool')).toEqual(['swimming_pool', 'pool_private']);
    expect(serverAmenityCodesFor('Mountain View')).toEqual(['mountain_view']);
    expect(serverAmenityCodesFor('Pet Friendly')).toEqual([]);
    expect(serverAmenityCodesFor(null)).toEqual([]);
  });

  it('sends amenities=... on the refetch and shows server-matched villas whose title has no "pool"', async () => {
    respond = (u) =>
      u.searchParams.get('amenities')
        ? { items: [listing(1, 'Villa Azure', ['swimming_pool'])], total: 1, page: 1, pageSize: 20 }
        : { items: [listing(1, 'Villa Azure', ['swimming_pool']), listing(2, 'Heritage Retreat', ['wifi'])], total: 2, page: 1, pageSize: 20 };
    renderPage();
    await settle();
    expect(requests[0]).not.toContain('amenities=');

    fireEvent.click(screen.getByTestId('marketplace-amenity-pool'));
    await settle();

    const last = new URL(requests[requests.length - 1]);
    expect(last.searchParams.get('amenities')).toBe('swimming_pool,pool_private');
    expect(last.searchParams.get('page')).toBe('1');
    // Pre-fix the client text-guess dropped "Villa Azure" (no 'pool' in the title).
    expect(screen.getAllByTestId('marketplace-card')).toHaveLength(1);
    expect(screen.getByText('Villa Azure')).toBeInTheDocument();
  });

  it('keeps the text fallback for an older API that ignores the parameter and sends no amenityCodes', async () => {
    respond = () => ({
      items: [listing(1, 'Pool House', undefined), listing(2, 'Heritage Retreat', undefined)],
      total: 2, page: 1, pageSize: 20,
    });
    renderPage();
    await settle();
    fireEvent.click(screen.getByTestId('marketplace-amenity-pool'));
    await settle();
    expect(screen.getAllByTestId('marketplace-card')).toHaveLength(1);
    expect(screen.getByText('Pool House')).toBeInTheDocument();
  });

  it('does not send the parameter for Pet Friendly (no master code) and still filters client-side', async () => {
    respond = () => ({
      items: [listing(1, 'Pet Paradise', ['wifi']), listing(2, 'Heritage Retreat', ['wifi'])],
      total: 2, page: 1, pageSize: 20,
    });
    renderPage();
    await settle();
    fireEvent.click(screen.getByTestId('marketplace-amenity-pet-friendly'));
    await settle();
    expect(requests.every((r) => !r.includes('amenities='))).toBe(true);
    expect(screen.getAllByTestId('marketplace-card')).toHaveLength(1);
  });
});
