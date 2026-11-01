// TASK-10299241 — the marketplace card guessed "Starting from per bed" from the title or category (a private
// room in a Hostel property got it too). The API now sends the listing's real `accommodationType`; the card says
// "per bed" only for `HostelDorm`, and an older API that sends no field gets no per-bed wording at all.
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
  city: 'Jaipur',
  pricePerNight: 700,
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

const cardFor = (title: string) => screen.getByText(title).closest('[data-testid="marketplace-card"]') as HTMLElement;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TASK-10299241: marketplace card "per bed" wording is keyed on accommodationType', () => {
  it('shows "Starting from per bed" on a HostelDorm listing', async () => {
    stubMarketplaceListings([
      { ...baseItem, id: 1, title: 'Zostel Dorm Bed', slug: '1', propertyType: 'Hostel', accommodationType: 'HostelDorm' },
    ]);

    renderPage();
    await settle();

    expect(within(cardFor('Zostel Dorm Bed')).getByTestId('hostel-per-bed-indicator')).toHaveTextContent(/per bed/i);
  });

  it('shows no per-bed wording on a private room in a Hostel property (title and category say hostel)', async () => {
    stubMarketplaceListings([
      {
        ...baseItem,
        id: 2,
        title: 'Zostel Hostel Private Room',
        slug: '2',
        propertyType: 'Hostel',
        category: 'hostel',
        accommodationType: 'VacationRental',
      },
    ]);

    renderPage();
    await settle();

    const card = cardFor('Zostel Hostel Private Room');
    // The property-type badge still names the property ...
    expect(within(card).getByTestId('property-type-badge')).toHaveTextContent('Hostel');
    // ... but the room is sold by the room, not the bed.
    expect(within(card).queryByTestId('hostel-per-bed-indicator')).not.toBeInTheDocument();
    expect(card).not.toHaveTextContent(/per bed/i);
  });

  it('shows no per-bed wording when an older API sends no accommodationType, even with "dorm" in the title', async () => {
    stubMarketplaceListings([{ ...baseItem, id: 3, title: 'Backpackers Dorm House', slug: '3' }]);

    renderPage();
    await settle();

    const card = cardFor('Backpackers Dorm House');
    expect(within(card).queryByTestId('hostel-per-bed-indicator')).not.toBeInTheDocument();
    expect(card).not.toHaveTextContent(/per bed/i);
  });

  it('reads the accommodationType case-insensitively like isHostelDorm (hosteldorm)', async () => {
    stubMarketplaceListings([{ ...baseItem, id: 4, title: 'Lowercase Dorm Bed', slug: '4', accommodationType: 'hosteldorm' }]);

    renderPage();
    await settle();

    expect(within(cardFor('Lowercase Dorm Bed')).getByTestId('hostel-per-bed-indicator')).toBeInTheDocument();
  });
});
