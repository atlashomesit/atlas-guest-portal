// MKT-001 — 18 of 27 live marketplace listings belong to WHATSAPP-tenant hosts who take no
// online payment, yet every card quoted a flat 3% "payment processing" fee (a literal `3`).
// TASK-7428 (2026-08-05 founder ruling): "no processor, no fee". These tests are RED before the
// fix: a `chargesOnlinePaymentFee: false` item still rendered "3% payment processing" and its
// est. total included the fee.
//
// MKT-002 — "N Verified homes" claims a verification that has never happened
// (`Listings.PhotosVerifiedAt` unset on 0 of 136 prod listings). RED before the fix: the trust
// strip always rendered "0 Verified homes" rather than omitting the claim.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

function stubMarketplaceListings(items: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/marketplace/properties')) {
        return { ok: true, json: async () => [] } as unknown as Response;
      }
      return { ok: true, json: async () => ({ items, total: items.length, page: 1, pageSize: 20 }) } as unknown as Response;
    }),
  );
}

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

// MKT-001 card-fee cases moved to MarketplaceHomepageCardPrice.test.tsx (TASK-10298999): the card no longer
// estimates a total from the listing's standard rate + a fee percent; it shows the checkout quote, and a
// no-gateway host's card leaves out the quote's payment fee ("no processor, no fee", TASK-7428).

describe('MKT-002: marketplace verified-homes trust strip honesty', () => {
  it('omits the "Verified homes" item when the count is 0', async () => {
    stubMarketplaceListings([
      {
        id: 1,
        tenantSlug: 'atlas',
        tenantName: 'Atlas',
        title: 'Unverified listing',
        city: 'Goa',
        pricePerNight: 5000,
        maxGuests: 2,
        slug: '1',
        hasVerifiedPhotos: false,
      },
    ]);

    renderPage();
    await settle();
    expect(screen.getByTestId('marketplace-trust-strip')).toBeInTheDocument();

    expect(screen.queryByText(/Verified homes/)).not.toBeInTheDocument();
  });

  it('shows the "Verified homes" item when at least one listing is verified', async () => {
    stubMarketplaceListings([
      {
        id: 1,
        tenantSlug: 'atlas',
        tenantName: 'Atlas',
        title: 'Verified listing',
        city: 'Goa',
        pricePerNight: 5000,
        maxGuests: 2,
        slug: '1',
        hasVerifiedPhotos: true,
      },
    ]);

    renderPage();
    await settle();
    expect(screen.getByTestId('marketplace-trust-strip')).toBeInTheDocument();

    expect(screen.getByText(/1 Verified homes/)).toBeInTheDocument();
  });
});

describe('TASK-101317: the marketplace never calls every host verified', () => {
  it('describes the marketplace without a blanket "verified hosts" claim', async () => {
    // No verification is required to list on the marketplace, and host identity checks are not
    // exposed per listing, so the page cannot say its hosts are verified.
    stubMarketplaceListings([
      { id: 1, tenantSlug: 'atlas', tenantName: 'Atlas', title: 'Any listing', city: 'Goa', pricePerNight: 5000, maxGuests: 2, slug: '1', hasVerifiedPhotos: false },
    ]);
    renderPage();
    await settle();
    expect(screen.getByRole('heading', { level: 1, name: 'Atlastays Marketplace' })).toBeInTheDocument();
    expect(screen.queryByText(/verified hosts/i)).not.toBeInTheDocument();
    expect(screen.getByText('Discover homes and rooms across India. Book direct with the owner.')).toBeInTheDocument();
  });
});
