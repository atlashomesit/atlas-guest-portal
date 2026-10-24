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

import MarketplaceHomepage, { resolveMarketplaceListingDisplayName } from './MarketplaceHomepage';
import { settle } from '../test/settle';

describe('TASK-10299086 — Marketplace cards display guest-facing display name', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('prefers displayName, title, and nameFormatted over internal SKU code', () => {
    // Strategy 0: explicit displayName
    expect(
      resolveMarketplaceListingDisplayName({
        id: 101,
        title: 'Atlas101',
        displayName: 'Studio 101 Lake View',
      }),
    ).toBe('Studio 101 Lake View');

    // Strategy 1: Atlas SKU extraction without displayName
    expect(
      resolveMarketplaceListingDisplayName({
        id: 101,
        title: 'Atlas101',
      }),
    ).toBe('Studio 101');

    expect(
      resolveMarketplaceListingDisplayName({
        id: 501,
        title: 'Atlas501_PH',
      }),
    ).toBe('Penthouse 501');

    // NameFormatted fallback
    expect(
      resolveMarketplaceListingDisplayName({
        id: 999,
        title: 'SKU_999_INTERNAL',
        nameFormatted: 'Mountain Chalet',
      }),
    ).toBe('Mountain Chalet');
  });

  it('renders guest-facing display names on marketplace cards', async () => {
    const mockApiResponse = {
      items: [
        {
          id: 101,
          tenantSlug: 'atlas',
          tenantName: 'Atlas Homestays',
          title: 'Atlas101',
          city: 'Hyderabad',
          pricePerNight: 4000,
          maxGuests: 2,
          slug: 'atlas101',
        },
        {
          id: 501,
          tenantSlug: 'atlas',
          tenantName: 'Atlas Homestays',
          title: 'Atlas501_PH',
          displayName: 'Penthouse 501',
          city: 'Hyderabad',
          pricePerNight: 12000,
          maxGuests: 4,
          slug: 'atlas501',
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/marketplace/listings')) {
        return new Response(JSON.stringify(mockApiResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/marketplace/properties')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter initialEntries={['/marketplace']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );

    await settle();

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Studio 101', 'Penthouse 501']);
  });
});
