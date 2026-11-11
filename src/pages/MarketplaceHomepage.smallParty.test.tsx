// GUEST-033: homepage lists homes sized for a 1-2 guest party first.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/api/client', () => ({
  buildApiUrl: (p: string) => `https://api.test${p}`,
  getApiHeaders: (t?: string | null) => (t ? { 'X-Tenant-Slug': t } : { 'X-Tenant-Slug': 'atlas' }),
}));
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
import { clearMarketplaceCardPriceCache } from '@/hooks/useMarketplaceCardPrices';
import { settle } from '../test/settle';

const mk = (id: number, title: string, maxGuests: number) => ({
  id, tenantSlug: 'atlas-homes', tenantName: 'Atlas Homes', title, city: 'Hyderabad',
  pricePerNight: 3500, maxGuests, slug: String(id), isGstRegistered: false, chargesOnlinePaymentFee: false,
});
const items = [mk(501, 'Penthouse 501', 7), mk(302, 'Studio 302', 2), mk(303, 'Flat 303', 3)];

function stub() {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = new URL(String(input));
    const body = url.pathname === '/marketplace/listings'
      ? { items, total: items.length, page: 1, pageSize: 20 }
      : url.pathname === '/marketplace/properties' ? [] : { listings: [] };
    return { ok: true, status: 200, json: async () => body, text: async () => '', headers: new Headers(), clone() { return this; } } as unknown as Response;
  }));
}
const order = () => screen.getAllByTestId('marketplace-card').map((c) => c.querySelector('h2')?.textContent);
const renderAt = (p: string) => render(<MemoryRouter initialEntries={[p]}><MarketplaceHomepage /></MemoryRouter>);

beforeEach(() => { clearMarketplaceCardPriceCache(); stub(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('GUEST-033: homepage order for a small party', () => {
  it('2 guests: homes sized for two come before the 7-guest penthouse', async () => {
    renderAt('/?guests=2');
    await settle(); await settle();
    expect(order()).toEqual(['Studio 302', 'Flat 303', 'Penthouse 501']);
  });
  it('3+ guests: order untouched', async () => {
    renderAt('/?guests=3');
    await settle(); await settle();
    expect(order()).toEqual(['Penthouse 501', 'Studio 302', 'Flat 303']);
  });
});
