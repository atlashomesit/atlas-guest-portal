// MKT-001 — 18 of 27 live marketplace listings belong to WHATSAPP-tenant hosts who take no
// online payment, yet every card quoted a flat 3% "payment processing" fee (a literal `3`).
// TASK-7428 (2026-08-05 founder ruling): "no processor, no fee". These tests are RED before the
// fix: a `chargesOnlinePaymentFee: false` item still rendered "3% payment processing" and its
// est. total included the fee.
//
// MKT-002 — "N Verified homes" claims a verification that has never happened
// (`Listings.PhotosVerifiedAt` unset on 0 of 136 prod listings). RED before the fix: the trust
// strip always rendered "0 Verified homes" rather than omitting the claim.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('MKT-001: marketplace card fee honesty', () => {
  beforeEach(() => {
    // Non-GST listing so the est-total is a pure base×nights check unaffected by GST rounding.
  });

  it('a WHATSAPP-tenant listing (chargesOnlinePaymentFee=false) shows no payment-processing fee text', async () => {
    stubMarketplaceListings([
      {
        id: 45,
        tenantSlug: 'staybycf',
        tenantName: 'Stay by City Focus',
        title: 'Elsiya loft',
        city: 'Goa',
        pricePerNight: 5000,
        maxGuests: 2,
        slug: '45',
        isGstRegistered: false,
        chargesOnlinePaymentFee: false,
        convenienceFeePercent: 0,
      },
    ]);

    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('marketplace-card')).toHaveLength(1));

    expect(screen.queryByText(/payment processing/i)).not.toBeInTheDocument();
    // Base ₹5,000 × 2 nights, no GST (unregistered), no fee — total must equal base×nights exactly.
    expect(screen.getByText(/₹10,000 est\. total/)).toBeInTheDocument();
  });

  it('an ONLINE-tenant listing (chargesOnlinePaymentFee=true) still shows its processing fee', async () => {
    stubMarketplaceListings([
      {
        id: 1,
        tenantSlug: 'nightnest',
        tenantName: 'Nightnest',
        title: 'City View Suite',
        city: 'Hyderabad',
        pricePerNight: 5000,
        maxGuests: 2,
        slug: '1',
        isGstRegistered: false,
        chargesOnlinePaymentFee: true,
        convenienceFeePercent: 3,
      },
    ]);

    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('marketplace-card')).toHaveLength(1));

    expect(screen.getByText(/3% payment processing/)).toBeInTheDocument();
  });

  it('an item with no fee fields yet (API not deployed) falls back to today\'s flat 3%', async () => {
    stubMarketplaceListings([
      {
        id: 2,
        tenantSlug: 'atlas',
        tenantName: 'Atlas',
        title: 'Legacy listing',
        city: 'Goa',
        pricePerNight: 5000,
        maxGuests: 2,
        slug: '2',
        isGstRegistered: false,
      },
    ]);

    renderPage();
    await waitFor(() => expect(screen.getAllByTestId('marketplace-card')).toHaveLength(1));

    expect(screen.getByText(/3% payment processing/)).toBeInTheDocument();
  });
});

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
    await waitFor(() => expect(screen.getByTestId('marketplace-trust-strip')).toBeInTheDocument());

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
    await waitFor(() => expect(screen.getByTestId('marketplace-trust-strip')).toBeInTheDocument());

    expect(screen.getByText(/1 Verified homes/)).toBeInTheDocument();
  });
});
