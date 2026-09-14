// TASK-101491 — the marketplace homepage requested a single page of 20 listings and rendered no
// pager, so every listing past the 20th was unreachable from the page. In prod this hid 7 of the
// largest paying tenant's 13 homes the moment marketplace supply passed 20.
//
// These tests are RED before that fix: the pre-fix component renders 20 cards, prints
// "20 listings" while the API reports 27, and exposes no control to reach the rest.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const TOTAL = 27;

function listing(id: number) {
  return {
    id,
    tenantSlug: id > 20 ? 'staybycf' : 'atlas',
    tenantName: id > 20 ? 'Stay by City Focus' : 'Atlas',
    title: `Listing ${id}`,
    city: 'Testville',
    pricePerNight: 5000,
    maxGuests: 2,
    slug: String(id),
    hasVerifiedPhotos: true,
  };
}

// Page 1 = ids 1..20, page 2 = ids 21..27 — mirrors the real prod shape where the tail of the
// ranking belonged entirely to one tenant.
function pageFor(pageNumber: number) {
  const start = (pageNumber - 1) * 20 + 1;
  const end = Math.min(pageNumber * 20, TOTAL);
  const items = [];
  for (let i = start; i <= end; i += 1) items.push(listing(i));
  return { items, total: TOTAL, page: pageNumber, pageSize: 20 };
}

let listingRequests: string[] = [];

beforeEach(() => {
  listingRequests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/marketplace/properties')) {
        return { ok: true, json: async () => [] } as unknown as Response;
      }
      listingRequests.push(u);
      const pageNumber = Number(new URL(u).searchParams.get('page') ?? '1');
      return { ok: true, json: async () => pageFor(pageNumber) } as unknown as Response;
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

describe('TASK-101491 marketplace homepage pagination', () => {
  it('reports the server total, not the number of listings loaded so far', async () => {
    renderPage();
    // Pre-fix this reads "20 listings" — the page under-reports its own inventory.
    await waitFor(() => expect(screen.getByText(`${TOTAL} listings`)).toBeInTheDocument());
  });

  it('exposes a control to reach listings beyond the first page', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('marketplace-card')).toHaveLength(20));
    // Pre-fix there is no such control at all, so every listing past the 20th is unreachable.
    expect(screen.getByTestId('marketplace-load-more')).toBeInTheDocument();
    expect(screen.getByTestId('marketplace-load-more-count')).toHaveTextContent('Showing 20 of 27');
  });

  it('appends the next page and retires the control once everything is loaded', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('marketplace-card')).toHaveLength(20));

    fireEvent.click(screen.getByTestId('marketplace-load-more'));

    await waitFor(() => expect(screen.getAllByTestId('marketplace-card')).toHaveLength(TOTAL));
    // The tail that was invisible in prod is now rendered.
    expect(screen.getByText('Listing 27')).toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-load-more')).not.toBeInTheDocument();

    const pages = listingRequests.map((u) => new URL(u).searchParams.get('page'));
    expect(pages).toEqual(['1', '2']);
  });

  it('offers no control when the first page already holds everything', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes('/marketplace/properties')) {
          return { ok: true, json: async () => [] } as unknown as Response;
        }
        return {
          ok: true,
          json: async () => ({ items: [listing(1), listing(2)], total: 2, page: 1, pageSize: 20 }),
        } as unknown as Response;
      }),
    );

    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('marketplace-card')).toHaveLength(2));
    expect(screen.queryByTestId('marketplace-load-more')).not.toBeInTheDocument();
    expect(screen.getByText('2 listings')).toBeInTheDocument();
  });
});

describe('TASK-101875 stale Show-more response is discarded on filter change', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  it('a filter change while loadMore is in flight discards the stale response', async () => {
    const stalePage2 = deferred<{ items: ReturnType<typeof listing>[]; total: number; page: number; pageSize: number }>();
    const freshPage1 = deferred<{ items: ReturnType<typeof listing>[]; total: number; page: number; pageSize: number }>();
    const seenUrls: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes('/marketplace/properties')) {
          return { ok: true, json: async () => [] } as unknown as Response;
        }
        seenUrls.push(u);
        const parsed = new URL(u);
        const pageNumber = Number(parsed.searchParams.get('page') ?? '1');
        const category = parsed.searchParams.get('category');
        if (pageNumber === 1 && !category) {
          // Initial page-1 for the default filter — resolve immediately so the grid mounts.
          return { ok: true, json: async () => pageFor(1) } as unknown as Response;
        }
        if (pageNumber === 2 && !category) {
          // Stale next-page fetch started before the filter change — hold it open.
          const data = await stalePage2.promise;
          return { ok: true, json: async () => data } as unknown as Response;
        }
        if (pageNumber === 1 && category === 'homes') {
          // Fresh page-1 for the new filter — hold it open so the test controls ordering.
          const data = await freshPage1.promise;
          return { ok: true, json: async () => data } as unknown as Response;
        }
        return { ok: false, json: async () => null } as unknown as Response;
      }),
    );

    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('marketplace-card')).toHaveLength(20));

    // Start the stale next-page fetch.
    fireEvent.click(screen.getByTestId('marketplace-load-more'));
    await waitFor(() =>
      expect(seenUrls.some((u) => new URL(u).searchParams.get('page') === '2')).toBe(true),
    );

    // Change the filter while page-2 is still in flight.
    fireEvent.click(screen.getByTestId('marketplace-filter-homes'));
    await waitFor(() =>
      expect(
        seenUrls.some(
          (u) =>
            new URL(u).searchParams.get('page') === '1' &&
            new URL(u).searchParams.get('category') === 'homes',
        ),
      ).toBe(true),
    );

    // Fresh filter results land first…
    freshPage1.resolve({
      items: [listing(101), listing(102)],
      total: 2,
      page: 1,
      pageSize: 20,
    });
    await waitFor(() => expect(screen.getByText('Listing 101')).toBeInTheDocument());

    // …then the stale old-filter page-2 lands. Without the TASK-101875 guard it appends
    // Listing 21..27 onto the fresh grid and rewinds `page`.
    stalePage2.resolve(pageFor(2));
    // Give the stale promise a chance to write state if unguarded.
    await new Promise((r) => setTimeout(r, 100));

    // Only the active filter's results survive and paging tracks the new filter's sequence.
    expect(screen.getAllByTestId('marketplace-card')).toHaveLength(2);
    expect(screen.getByText('Listing 101')).toBeInTheDocument();
    expect(screen.getByText('Listing 102')).toBeInTheDocument();
    expect(screen.queryByText('Listing 21')).not.toBeInTheDocument();
    expect(screen.queryByText('Listing 1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-load-more')).not.toBeInTheDocument();
  });
});
