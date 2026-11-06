import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/api/client', () => ({ buildApiUrl: (p: string) => `https://api.test${p}` }));
vi.mock('@/components/SEO', () => ({ default: () => null }));
vi.mock('@/components/map/MultiPinMap', () => ({ default: () => <div data-testid="mock-multi-pin-map" /> }));
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

// TASK-1040072: 115 homes, every one with coordinates. The server clamps pageSize > 100 to 20 (the
// QA symptom was "Map (6)" against 115 listings), so the map must ask for <= 100 and page.
const TOTAL = 115;
const allProps = Array.from({ length: TOTAL }, (_, i) => ({
  propertyId: 1000 + i,
  listingId: 2000 + i,
  tenantSlug: 'goa-stays',
  propertyName: `Villa ${i + 1}`,
  propertyAddress: 'Goa',
  listingName: `Villa ${i + 1}`,
  latitude: 15 + i / 1000,
  longitude: 73 + i / 1000,
}));

let propertyUrls: string[] = [];

beforeEach(() => {
  propertyUrls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = new URL(String(url));
      if (u.pathname === '/marketplace/properties') {
        propertyUrls.push(String(url));
        const page = Number(u.searchParams.get('page') ?? '1');
        const raw = Number(u.searchParams.get('pageSize') ?? '20');
        const size = raw <= 0 || raw > 100 ? 20 : raw; // MarketplaceController.NormalizePageSize
        return { ok: true, json: async () => allProps.slice((page - 1) * size, page * size) } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({ items: [], total: TOTAL, page: 1, pageSize: 20 }),
      } as unknown as Response;
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TASK-1040072 marketplace homepage map covers every home, not just the first server page', () => {
  it('asks /marketplace/properties for <= 100 per page, pages through, and Map (N) counts all 115 pins', async () => {
    render(
      <MemoryRouter>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );
    await settle();
    await settle();

    expect(propertyUrls.length).toBeGreaterThanOrEqual(2);
    for (const url of propertyUrls) {
      expect(Number(new URL(url).searchParams.get('pageSize'))).toBeLessThanOrEqual(100);
    }
    expect(screen.getByTestId('marketplace-map-toggle')).toHaveTextContent(`Map (${TOTAL})`);
  });
});
