// TASK-102711 — a failed listings fetch on the marketplace homepage fell into the TASK-4309 empty
// state, so an API blip told the guest "No stays match these filters yet — try a different city".
// RED before the fix: both a thrown fetch and a 5xx render `marketplace-empty` and no alert.
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const listing = {
  id: 1,
  tenantSlug: 'atlas',
  tenantName: 'Atlas',
  title: 'Listing 1',
  city: 'Testville',
  pricePerNight: 5000,
  maxGuests: 2,
  slug: '1',
  hasVerifiedPhotos: true,
};

type ListingsResponder = () => Promise<Response>;

function stubFetch(responders: ListingsResponder[]) {
  let call = 0;
  const listingsFetch = vi.fn(() => responders[Math.min(call++, responders.length - 1)]());
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/marketplace/properties')) {
        return { ok: true, json: async () => [] } as unknown as Response;
      }
      return listingsFetch();
    }),
  );
  return listingsFetch;
}

const ok = async () =>
  ({ ok: true, json: async () => ({ items: [listing], total: 1 }) }) as unknown as Response;
const serverError = async () => ({ ok: false, status: 503, json: async () => null }) as unknown as Response;
const networkError = async () => {
  throw new TypeError('Failed to fetch');
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <MarketplaceHomepage />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MarketplaceHomepage load failure (TASK-102711)', () => {
  it.each([
    ['a network error', networkError],
    ['a 5xx response', serverError],
  ])('shows a retryable alert, not the empty state, on %s', async (_label, failure) => {
    stubFetch([failure]);
    renderPage();

    await settle();
    const alert = screen.getByTestId('marketplace-load-error');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(screen.queryByTestId('marketplace-empty')).toBeNull();
  });

  it('Try again re-fetches and renders the listings once the API recovers', async () => {
    const listingsFetch = stubFetch([serverError, ok]);
    renderPage();

    await settle();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await settle();
    expect(screen.getAllByTestId('marketplace-card')).toHaveLength(1);
    expect(screen.queryByTestId('marketplace-load-error')).toBeNull();
    expect(listingsFetch).toHaveBeenCalledTimes(2);
  });
});
