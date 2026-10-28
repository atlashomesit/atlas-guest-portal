// MKT-029 — a traveler on atlastays.com could not tell which stays confirm on payment and which need the host
// to approve, until they opened the detail page. The API now sends `isInstantBookable` (true only for a
// Razorpay / Stripe / Atlas-managed rail: UPI hosts must confirm the payment first, so they are false) and the
// card renders an "Instant Book" chip ONLY when it is exactly `true`. A missing field (an older API) is
// "unknown" and shows no chip.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
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

const baseItem = {
  tenantSlug: 'atlas',
  tenantName: 'Atlas',
  city: 'Goa',
  pricePerNight: 5000,
  maxGuests: 2,
};

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

describe('MKT-029: Instant Book chip on marketplace cards', () => {
  it('renders the chip on a listing the API marks isInstantBookable: true', async () => {
    stubMarketplaceListings([{ ...baseItem, id: 1, title: 'Gateway villa', slug: '1', isInstantBookable: true }]);

    renderPage();
    await settle();

    const card = screen.getByTestId('marketplace-card');
    const chip = within(card).getByTestId('marketplace-instant-book-chip');
    expect(chip).toHaveTextContent('Instant Book');
  });

  it('renders no chip when isInstantBookable is false (UPI, WhatsApp or manual host)', async () => {
    stubMarketplaceListings([{ ...baseItem, id: 2, title: 'UPI villa', slug: '2', isInstantBookable: false }]);

    renderPage();
    await settle();

    expect(screen.getByTestId('marketplace-card')).toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-instant-book-chip')).not.toBeInTheDocument();
  });

  it('renders no chip when the field is missing (an older API): unknown is not instant', async () => {
    stubMarketplaceListings([{ ...baseItem, id: 3, title: 'Legacy API villa', slug: '3' }]);

    renderPage();
    await settle();

    expect(screen.getByTestId('marketplace-card')).toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-instant-book-chip')).not.toBeInTheDocument();
  });

  it('renders no chip for a truthy-but-not-true value (only an explicit true counts)', async () => {
    stubMarketplaceListings([{ ...baseItem, id: 4, title: 'Odd payload villa', slug: '4', isInstantBookable: 'true' }]);

    renderPage();
    await settle();

    expect(screen.getByTestId('marketplace-card')).toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-instant-book-chip')).not.toBeInTheDocument();
  });

  it('shows the chip only on the qualifying card when listings are mixed', async () => {
    stubMarketplaceListings([
      { ...baseItem, id: 5, title: 'Instant villa', slug: '5', isInstantBookable: true },
      { ...baseItem, id: 6, title: 'Enquiry villa', slug: '6', isInstantBookable: false },
    ]);

    renderPage();
    await settle();

    expect(screen.getAllByTestId('marketplace-card')).toHaveLength(2);
    const instantCard = screen.getByText('Instant villa').closest('[data-testid="marketplace-card"]') as HTMLElement;
    const enquiryCard = screen.getByText('Enquiry villa').closest('[data-testid="marketplace-card"]') as HTMLElement;
    expect(within(instantCard).getByTestId('marketplace-instant-book-chip')).toBeInTheDocument();
    expect(within(enquiryCard).queryByTestId('marketplace-instant-book-chip')).not.toBeInTheDocument();
  });
});
