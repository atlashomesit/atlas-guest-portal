// TASK-10089 — marketplace cards must distinguish native completed-stay feedback
// ("N verified stays", Atlas-verified only) from imported feedback ("N Google
// reviews"). External-only cards must never claim a verified stay, and listings
// with no reviews of either kind render no provenance at all (no fabricated proof).
//
// RED before the fix: the card has no provenance row — only star/count and the
// generic sentiment chip — so an external-only listing is indistinguishable from
// a natively-reviewed one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
import { formatExternalReviewsLabel, formatVerifiedStaysLabel } from './MarketplaceHomepage';

function listing(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    tenantSlug: 'atlas',
    tenantName: 'Atlas',
    title: `Listing ${id}`,
    city: 'Testville',
    pricePerNight: 5000,
    maxGuests: 2,
    slug: String(id),
    ...extra,
  };
}

const NATIVE_ONLY = listing(1, { rating: 4.5, reviewCount: 2, verifiedStayCount: 2, externalReviewCount: null });
const EXTERNAL_ONLY = listing(2, { rating: null, reviewCount: null, verifiedStayCount: null, externalReviewCount: 3 });
const MIXED = listing(3, { rating: 4.0, reviewCount: 3, verifiedStayCount: 1, externalReviewCount: 1 });
const NO_REVIEWS = listing(4, { rating: null, reviewCount: null, verifiedStayCount: null, externalReviewCount: null });

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
        json: async () => ({ items: [NATIVE_ONLY, EXTERNAL_ONLY, MIXED, NO_REVIEWS], total: 4, page: 1, pageSize: 20 }),
      } as unknown as Response;
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

describe('TASK-10089 marketplace review provenance labels', () => {
  it('native-only card renders verified stays and no Google label', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('marketplace-card')).toHaveLength(4));
    const cards = screen.getAllByTestId('marketplace-card');
    const native = within(cards[0]);
    expect(native.getByText('2 verified stays')).toBeInTheDocument();
    expect(native.queryByText(/Google review/)).not.toBeInTheDocument();
  });

  it('external-only card renders Google reviews and never claims verified', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('marketplace-card')).toHaveLength(4));
    const cards = screen.getAllByTestId('marketplace-card');
    const external = within(cards[1]);
    expect(external.getByText('3 Google reviews')).toBeInTheDocument();
    expect(external.queryByText(/verified/i)).not.toBeInTheDocument();
  });

  it('mixed card renders both labels', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('marketplace-card')).toHaveLength(4));
    const cards = screen.getAllByTestId('marketplace-card');
    const mixed = within(cards[2]);
    expect(mixed.getByText('1 verified stay')).toBeInTheDocument();
    expect(mixed.getByText('1 Google review')).toBeInTheDocument();
  });

  it('card with neither source renders no provenance row (no fabricated proof)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('marketplace-card')).toHaveLength(4));
    const cards = screen.getAllByTestId('marketplace-card');
    expect(within(cards[3]).queryByTestId('marketplace-review-provenance')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('marketplace-review-provenance')).toHaveLength(3);
  });
});

describe('TASK-10089 provenance label formatting', () => {
  it('verified stays: null/zero render nothing, singular/plural exact', () => {
    expect(formatVerifiedStaysLabel(null)).toBeNull();
    expect(formatVerifiedStaysLabel(undefined)).toBeNull();
    expect(formatVerifiedStaysLabel(0)).toBeNull();
    expect(formatVerifiedStaysLabel(1)).toBe('1 verified stay');
    expect(formatVerifiedStaysLabel(2)).toBe('2 verified stays');
  });

  it('Google reviews: null/zero render nothing, singular/plural exact', () => {
    expect(formatExternalReviewsLabel(null)).toBeNull();
    expect(formatExternalReviewsLabel(undefined)).toBeNull();
    expect(formatExternalReviewsLabel(0)).toBeNull();
    expect(formatExternalReviewsLabel(1)).toBe('1 Google review');
    expect(formatExternalReviewsLabel(5)).toBe('5 Google reviews');
  });
});
