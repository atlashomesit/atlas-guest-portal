// MKT-034 — the marketplace homepage has an "Explore Top Destinations" strip under the hero: one chip per city guide linking
// to /homestays-in-{slug}, a link to the /destinations directory, thumbnails borrowed only from listings already loaded in
// that city, and no stay counts (one loaded page would under-report).
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
import { CITY_LANDING_SLUGS } from '@/content/cities/cityLandingSlugs';
import { settle } from '../test/settle';

const baseItem = { tenantSlug: 'atlas', tenantName: 'Atlas', pricePerNight: 5000, maxGuests: 2 };

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

describe('MKT-034: Explore Top Destinations strip on the marketplace homepage', () => {
  it('renders one chip per city guide, each linking to /homestays-in-{slug}', async () => {
    stubMarketplaceListings([]);
    renderPage();
    await settle();

    const strip = screen.getByRole('navigation', { name: 'Explore Top Destinations' });
    expect(strip).toBe(screen.getByTestId('marketplace-destinations-strip'));
    for (const slug of CITY_LANDING_SLUGS) {
      expect(within(strip).getByTestId(`marketplace-destination-chip-${slug}`)).toHaveAttribute('href', `/homestays-in-${slug}`);
    }
  });

  it('links to the full /destinations directory', async () => {
    stubMarketplaceListings([]);
    renderPage();
    await settle();

    expect(screen.getByTestId('marketplace-destinations-all')).toHaveAttribute('href', '/destinations');
  });

  it('shows no stay counts in the strip', async () => {
    stubMarketplaceListings([{ ...baseItem, id: 1, title: 'Goa villa', city: 'Goa', slug: '1' }]);
    renderPage();
    await settle();

    const strip = screen.getByTestId('marketplace-destinations-strip');
    expect(within(strip).queryByText(/\bstays?\b/i)).not.toBeInTheDocument();
  });

  it('borrows a thumbnail only from a loaded listing in that city (whole-word match, never "Goat Farm" for Goa)', async () => {
    stubMarketplaceListings([
      { ...baseItem, id: 1, title: 'Beach villa', city: 'Goa', slug: '1', coverImageUrl: 'https://cdn.test/goa.jpg' },
      { ...baseItem, id: 2, title: 'Goat Farm Stay', city: 'Somewhere', slug: '2', coverImageUrl: 'https://cdn.test/goat.jpg' },
    ]);
    renderPage();
    await settle();

    const goaChip = screen.getByTestId('marketplace-destination-chip-goa');
    expect(within(goaChip).getByTestId('marketplace-destination-thumb')).toHaveAttribute('src', 'https://cdn.test/goa.jpg');
    // Every other chip has no matching listing, so it keeps the pin and no photo.
    const manaliChip = screen.getByTestId('marketplace-destination-chip-manali');
    expect(within(manaliChip).queryByTestId('marketplace-destination-thumb')).not.toBeInTheDocument();
  });
});
