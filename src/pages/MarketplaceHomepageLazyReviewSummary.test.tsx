/**
 * TASK-1039954: every marketplace card used to mount a ReviewSummary that fired its own
 * GET /api/listings/{id}/reviews/summary on mount - 14-20 requests the moment the grid rendered, and 20+
 * net::ERR_ABORTED when the guest navigated away. Each card now asks only once it is near the viewport.
 *
 * RED on the unfixed base: all 16 summary requests fire at mount and no sentinel exists.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/api/client', () => ({
  buildApiUrl: (p: string) => `https://api.test${p}`,
  getApiHeaders: () => ({}),
}));
vi.mock('@/components/SEO', () => ({ default: () => null }));
vi.mock('@/components/map/MultiPinMap', () => ({ default: () => null }));
vi.mock('@/components/marketplace/airbnbSearch/AirbnbSearchBar', () => ({ default: () => null }));
vi.mock('@/components/OwnerShareBadge', () => ({ default: () => null }));
vi.mock('@/components/ui/OptimizedImage', () => ({ default: () => null }));
vi.mock('@/components/apartments/SkeletonCard', () => ({ default: () => null }));
vi.mock('@/utils/guestHistory', () => ({ getFavoriteIds: () => [], toggleFavorite: () => {} }));
vi.mock('@/tenant/paymentRail', () => ({ hasOnlinePaymentRail: () => false }));
vi.mock('@/utils/marketplaceListingCover', () => ({
  enrichMarketplaceCoverItems: async <T,>(items: T[]) => items,
}));

import MarketplaceHomepage from './MarketplaceHomepage';
import { _clearReviewSummaryCacheForTests } from '../components/ReviewSummary';
import { settle } from '../test/settle';

const CARD_COUNT = 16;
const listings = Array.from({ length: CARD_COUNT }, (_, i) => ({
  id: 101 + i,
  tenantSlug: `tenant-${i}`,
  tenantName: `Tenant ${i}`,
  title: `Stay ${i}`,
  displayName: `Stay ${i}`,
  city: 'Goa',
  pricePerNight: 3000 + i,
  maxGuests: 4,
  slug: String(101 + i),
  rating: 4.6,
  reviewCount: 8,
  verifiedStayCount: 3,
}));

type FakeObserver = { callback: IntersectionObserverCallback; targets: Element[] };
let observers: FakeObserver[] = [];
let requestedUrls: string[] = [];

class FakeIntersectionObserver {
  private readonly record: FakeObserver;
  constructor(callback: IntersectionObserverCallback) {
    this.record = { callback, targets: [] };
    observers.push(this.record);
  }
  observe(target: Element) {
    this.record.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    this.record.targets = [];
  }
  takeRecords() {
    return [];
  }
}

function reveal(target: Element) {
  for (const o of observers) {
    if (o.targets.includes(target)) {
      o.callback(
        [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
        o as unknown as IntersectionObserver,
      );
    }
  }
}

const summaryCalls = () => requestedUrls.filter((u) => u.includes('/reviews/summary'));

beforeEach(() => {
  _clearReviewSummaryCacheForTests();
  observers = [];
  requestedUrls = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      requestedUrls.push(u);
      if (u.includes('/reviews/summary')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            listingId: 0,
            reviewCount: 8,
            sentiment: 'positive',
            positivePercent: 90,
            topKeywords: ['clean', 'quiet'],
            verifiedStayCount: 3,
          }),
        } as unknown as Response;
      }
      if (u.includes('/marketplace/properties')) {
        return { ok: true, json: async () => [] } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({ items: listings, total: listings.length, page: 1, pageSize: 20 }),
      } as unknown as Response;
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderGrid = async () => {
  render(
    <MemoryRouter initialEntries={['/?brand=atlastays&checkIn=2026-11-05&checkOut=2026-11-07&guests=2']}>
      <MarketplaceHomepage />
    </MemoryRouter>,
  );
  await settle();
};

describe('TASK-1039954: marketplace review summaries are not an N+1 burst at mount', () => {
  it('fires no summary request until a card nears the viewport, then exactly one per revealed card', async () => {
    await renderGrid();

    expect(screen.getAllByTestId('marketplace-card').length).toBe(CARD_COUNT);
    expect(summaryCalls()).toHaveLength(0);

    const sentinels = screen.getAllByTestId('review-summary-sentinel');
    expect(sentinels).toHaveLength(CARD_COUNT);

    await act(async () => {
      reveal(sentinels[0]);
      reveal(sentinels[1]);
    });
    await settle();

    expect(summaryCalls()).toHaveLength(2);
    expect(summaryCalls().some((u) => u.endsWith('/api/listings/101/reviews/summary'))).toBe(true);
    expect(summaryCalls().some((u) => u.endsWith('/api/listings/102/reviews/summary'))).toBe(true);
    expect(summaryCalls().some((u) => u.endsWith('/api/listings/110/reviews/summary'))).toBe(false);
    // The chip still renders for a card that was revealed.
    expect(screen.getAllByText(/Mostly positive/).length).toBe(2);
  });
});
