/**
 * GUEST-065 item 1 (founder ruling 2026-11-19): the guest home page shows the LIVE price for the dates the guest picked, or
 * "See the price for your dates" when no dates are picked, and no cached or hard-coded number anywhere on that page.
 *
 * The default home grid (HomePage_Locations, tested beside it) and the three alternate "our homes" layouts (coastal gallery,
 * editorial featured stays, photo-first stack) all print a card price. The three layouts used to print the listing's static
 * base rate ("₹6,000 / night") whatever the dates were, so a host on one of those themes still showed a number that disagreed
 * with the booking box. They now follow the same rule as the default grid.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CoastalListingsGallery from './coastal/ListingsGallery';
import EditorialFeaturedStays from './editorial/EditorialFeaturedStays';
import PhotoFirstListingsStack from './photoFirst/PhotoFirstListingsStack';
import { CurrencyProvider } from '../contexts/CurrencyContext';
import { settle } from '../test/settle';
import * as useTenantListingsModule from '../hooks/useTenantListings';
import { clearMarketplaceCardPriceCache } from '../hooks/useMarketplaceCardPrices';

const HINT = 'See the price for your dates';

const properties = [
  { id: '7', listingId: 7, property_name: 'Garden Suite', property_location: 'Madikeri', property_price: 6000 },
  { id: '8', listingId: 8, property_name: 'Hill Room', property_location: 'Madikeri', property_price: 9000 },
];

const LAYOUTS: Array<[string, React.ComponentType]> = [
  ['coastal gallery', CoastalListingsGallery],
  ['editorial featured stays', EditorialFeaturedStays],
  ['photo-first stack', PhotoFirstListingsStack],
];

/** The quote the API answers for a stay: listing 7 = ₹5,000 for 2 nights (₹2,500 a night), listing 8 = ₹7,200 (₹3,600 a night); anything else fails. */
function stubQuotes(opts: { fail?: boolean } = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input: unknown) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname.includes('/api/pricing/guest-breakdown')) {
      if (opts.fail) {
        return Promise.resolve({ ok: false, status: 400, json: async () => ({ message: 'unavailable' }) } as Response);
      }
      const total = url.searchParams.get('listingId') === '7' ? 5000 : 7200;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ baseAmount: total, discountAmount: 0, convenienceFeeAmount: 0, finalAmount: total }),
      } as Response);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
  });
}

function renderLayout(Layout: React.ComponentType, search = '') {
  return render(
    <CurrencyProvider>
      <MemoryRouter initialEntries={[{ pathname: '/', search }]}>
        <Layout />
      </MemoryRouter>
    </CurrencyProvider>,
  );
}

describe.each(LAYOUTS)('GUEST-065 %s: no hard-coded number on the home page', (_name, Layout) => {
  beforeEach(() => {
    clearMarketplaceCardPriceCache();
    vi.spyOn(useTenantListingsModule, 'useTenantListings').mockReturnValue({
      listings: [] as never,
      properties: properties as never,
      state: 'success',
      fetchErrorMessage: null,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('with no dates picked every card says "See the price for your dates" and shows no rupee amount', async () => {
    const spy = stubQuotes();
    renderLayout(Layout);
    await settle();

    expect(screen.getAllByTestId('home-card-price-hint')).toHaveLength(2);
    screen.getAllByTestId('home-card-price-hint').forEach((el) => expect(el).toHaveTextContent(HINT));
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/₹|\/ night|from\s*₹/i);
    expect(text).not.toContain('6,000');
    expect(text).not.toContain('9,000');
    expect(spy.mock.calls.some((c) => String(c[0]).includes('/api/pricing/guest-breakdown'))).toBe(false);
  });

  it('with dates picked each card shows the nightly price of the quote for those dates, not the base rate', async () => {
    const spy = stubQuotes();
    renderLayout(Layout, '?checkIn=2026-10-30&checkOut=2026-11-01&guests=2');
    await settle();

    const prices = screen.getAllByTestId('home-card-real-price').map((el) => el.textContent ?? '');
    expect(prices).toHaveLength(2);
    expect(prices[0]).toMatch(/2,500/);
    expect(prices[1]).toMatch(/3,600/);
    expect(screen.queryByTestId('home-card-price-hint')).toBeNull();
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('6,000');
    expect(text).not.toContain('9,000');
    const asked = spy.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('/api/pricing/guest-breakdown'));
    expect(asked.length).toBeGreaterThanOrEqual(2);
    expect(asked[0]).toContain('checkIn=2026-10-30');
    expect(asked[0]).toContain('checkOut=2026-11-01');
  });

  it('says "Sold out for your dates" and no number when the quote for those dates fails', async () => {
    stubQuotes({ fail: true });
    renderLayout(Layout, '?checkIn=2026-10-30&checkOut=2026-11-01&guests=2');
    await settle();

    expect(screen.getAllByTestId('home-card-sold-out')).toHaveLength(2);
    expect(document.body.textContent ?? '').not.toMatch(/₹/);
  });
});
