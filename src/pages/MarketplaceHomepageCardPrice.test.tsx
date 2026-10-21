// TASK-10298999 (P0, founder ruling 2026-10-21: the website price shown = the price charged).
// www.atlastays.com cards printed the listing row's standard rate plus a client-side 3% estimate —
// "₹3,500 / night · ₹7,210 est. total (2 nights)" for Atlas Homes flats whose real 2-night total
// (the checkout quote, 28–30 Oct) is ₹5,451. These tests are RED before the fix: the card never asked
// the quote engine, so the quote's numbers never appeared and the stale ₹3,500 / ₹7,210 did.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
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

// Atlas Homes Studio 302 as the marketplace row carries it: the stale standard rate.
const atlas302 = {
  id: 302,
  tenantSlug: 'atlas-homes',
  tenantName: 'Atlas Homes',
  title: 'Studio 302',
  city: 'Hyderabad',
  pricePerNight: 3500,
  maxGuests: 2,
  slug: '302',
  isGstRegistered: false,
  chargesOnlinePaymentFee: true,
  convenienceFeePercent: 3,
};

// The checkout quote for 28–30 Oct, 2 guests (GET /api/pricing/guest-breakdown): standard ₹7,056,
// 25% direct-booking discount ₹1,764, 3% payment fee ₹159 → ₹5,451 all in.
const quote2Nights = {
  baseAmount: 7056,
  discountAmount: 1764,
  globalDiscountPercent: 25,
  convenienceFeeAmount: 159,
  convenienceFeePercent: 3,
  touristTaxAmount: 0,
  finalAmount: 5451,
};

type Route = (url: URL, init?: RequestInit) => { ok: boolean; status?: number; body: unknown } | null;
let calls: { url: URL; headers: Record<string, string> }[] = [];

function stubApi(items: unknown[], route: Route) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
      if (url.pathname === '/marketplace/properties') {
        return { ok: true, json: async () => [] } as unknown as Response;
      }
      if (url.pathname === '/marketplace/listings') {
        return { ok: true, json: async () => ({ items, total: items.length, page: 1, pageSize: 20 }) } as unknown as Response;
      }
      const r = route(url, init);
      if (!r) return { ok: false, status: 404, json: async () => ({}), text: async () => '' } as unknown as Response;
      return {
        ok: r.ok,
        status: r.status ?? 200,
        json: async () => r.body,
        text: async () => JSON.stringify(r.body),
        headers: new Headers(),
        clone() {
          return this;
        },
      } as unknown as Response;
    }),
  );
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <MarketplaceHomepage />
    </MemoryRouter>,
  );

beforeEach(() => {
  calls = [];
  clearMarketplaceCardPriceCache();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TASK-10298999: marketplace card price = checkout quote', () => {
  it('with searched dates, the card shows the quote for those dates from the home’s own host — not the stale ₹3,500 / ₹7,210', async () => {
    stubApi([atlas302], (url) =>
      url.pathname === '/api/pricing/guest-breakdown' ? { ok: true, body: quote2Nights } : null,
    );

    renderAt('/?checkIn=2026-10-28&checkOut=2026-10-30&guests=2');
    await settle();
    await settle();

    const card = screen.getByTestId('marketplace-card');
    // Card total = quote FinalAmount (to the rupee), struck standard, real nightly, saving.
    expect(within(card).getByTestId('marketplace-card-total')).toHaveTextContent(
      '₹5,451 total · 2 nights · all fees included',
    );
    expect(within(card).getByTestId('marketplace-card-standard-price')).toHaveTextContent('₹3,528');
    expect(within(card).getByTestId('marketplace-card-real-price')).toHaveTextContent('₹2,646');
    expect(within(card).getByTestId('marketplace-card-saving')).toHaveTextContent('25% off — booked direct');
    // The stale row price never reaches the guest.
    expect(card).not.toHaveTextContent('₹3,500');
    expect(card).not.toHaveTextContent('₹7,210');

    // Same engine the booking box uses, for the searched stay, scoped to the listing owner.
    const q = calls.find((c) => c.url.pathname === '/api/pricing/guest-breakdown');
    expect(q).toBeDefined();
    expect(q!.url.searchParams.get('listingId')).toBe('302');
    expect(q!.url.searchParams.get('checkIn')).toBe('2026-10-28');
    expect(q!.url.searchParams.get('checkOut')).toBe('2026-10-30');
    expect(q!.url.searchParams.get('guests')).toBe('2');
    expect(q!.headers['X-Tenant-Slug']).toBe('atlas-homes');
  });

  it('without dates, the card shows tonight’s quote row (daily-summary) like the tenant homepage card', async () => {
    stubApi([atlas302], (url) =>
      url.pathname === '/api/pricing/daily-summary' && url.searchParams.get('listingId') === '302'
        ? {
            ok: true,
            body: {
              date: '2026-10-21',
              listings: [
                { listingId: 302, listingName: 'Studio 302', baseAmount: 3528, discountAmount: 882, convenienceFeePercent: 3, finalAmount: 2725, globalDiscountPercent: 25 },
              ],
            },
          }
        : null,
    );

    renderAt('/');
    await settle();
    await settle();

    const card = screen.getByTestId('marketplace-card');
    expect(within(card).getByTestId('marketplace-card-total')).toHaveTextContent(
      '₹2,725 total · 1 night · all fees included',
    );
    expect(within(card).getByTestId('marketplace-card-real-price')).toHaveTextContent('₹2,646');
    expect(card).not.toHaveTextContent('₹3,500');
    const q = calls.find((c) => c.url.pathname === '/api/pricing/daily-summary');
    expect(q!.headers['X-Tenant-Slug']).toBe('atlas-homes');
  });

  it('MKT-001 / TASK-7428: a host with no online gateway is shown the quote without the payment fee nobody charges', async () => {
    stubApi([{ ...atlas302, id: 45, tenantSlug: 'staybycf', chargesOnlinePaymentFee: false }], (url) =>
      url.pathname === '/api/pricing/guest-breakdown' ? { ok: true, body: quote2Nights } : null,
    );

    renderAt('/?checkIn=2026-10-28&checkOut=2026-10-30&guests=2');
    await settle();
    await settle();

    // ₹5,451 − ₹159 fee = ₹5,292.
    expect(screen.getByTestId('marketplace-card-total')).toHaveTextContent('₹5,292 total · 2 nights · all fees included');
    expect(screen.queryByText(/payment processing/i)).not.toBeInTheDocument();
  });

  it('when no quote is available the card shows no number rather than the stale rate', async () => {
    stubApi([atlas302], () => ({ ok: false, status: 400, body: { error: 'NO_USABLE_RATE' } }));

    renderAt('/?checkIn=2026-10-28&checkOut=2026-10-30&guests=2');
    await settle();
    await settle();

    const card = screen.getByTestId('marketplace-card');
    expect(within(card).getByTestId('marketplace-card-price-unavailable')).toHaveTextContent('Choose dates to see the price.');
    expect(card).not.toHaveTextContent('₹3,500');
    expect(card).not.toHaveTextContent('est. total');
  });
});
