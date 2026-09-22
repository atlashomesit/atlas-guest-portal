// TASK-102058 — marketplace property-card links must carry the active search criteria
// forward so the details page hydrates (and Back-navigation has params to restore).
//
// RED before the fix: `marketplaceListingPath` emits `?tenant=<slug>` only, dropping
// city/checkIn/checkOut/guests — SearchPage already propagates its full querySuffix,
// the homepage grid does not.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

function listing(id: number) {
  return {
    id,
    tenantSlug: 'atlas',
    tenantName: 'Atlas',
    title: `Listing ${id}`,
    city: 'Goa',
    pricePerNight: 5000,
    maxGuests: 4,
    slug: String(id),
  };
}

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
        json: async () => ({ items: [listing(1)], total: 1, page: 1, pageSize: 20 }),
      } as unknown as Response;
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TASK-102058 marketplace card links preserve search criteria', () => {
  it('View-home href carries city/checkIn/checkOut/guests alongside tenant', async () => {
    render(
      <MemoryRouter initialEntries={['/?city=Goa&checkIn=2026-12-10&checkOut=2026-12-12&guests=4']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Listing 1')).toBeInTheDocument());
    const link = screen.getByRole('link', { name: /view home/i });
    const href = link.getAttribute('href') ?? '';
    const query = href.split('?')[1] ?? '';
    const params = new URLSearchParams(query);
    expect(params.get('tenant')).toBe('atlas');
    expect(params.get('city')).toBe('Goa');
    expect(params.get('checkIn')).toBe('2026-12-10');
    expect(params.get('checkOut')).toBe('2026-12-12');
    expect(params.get('guests')).toBe('4');
  });
});
