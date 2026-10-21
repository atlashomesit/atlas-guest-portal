/**
 * GUEST-034 (founder ruling 2026-10-21, price shown = charged): with dates in the search box each card shows
 * the checkout quote for THOSE dates and guests (GET /api/pricing/guest-breakdown), not tonight's
 * daily-summary rate multiplied by the nights. Without dates the card keeps tonight's price.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { CurrencyProvider } from '../contexts/CurrencyContext';
import { clearMarketplaceCardPriceCache } from '../hooks/useMarketplaceCardPrices';
import SearchPage from '../pages/SearchPage';
import { settle } from '../test/settle';

vi.mock('../api/listingClient', () => ({
  fetchPublicListings: vi.fn(() =>
    Promise.resolve([{ id: 7, name: 'Penthouse', title: 'Penthouse', maxGuests: 4, baseNightlyRate: 5998 }]),
  ),
}));

vi.mock('../runtime-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime-config')>();
  return { ...actual, getApiBaseUrl: () => 'https://api.example.com', getGlobalDiscountPercent: () => 0 };
});

// A host with an online gateway: the quote's payment fee is part of what is charged.
vi.mock('../tenant/paymentRail', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../tenant/paymentRail')>()),
  hasOnlinePaymentRail: () => true,
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });

function urlOf(args: unknown[]): string {
  return String(args[0] ?? '');
}

beforeEach(() => {
  mockFetch.mockReset();
  clearMarketplaceCardPriceCache();
  mockFetch.mockImplementation((input: unknown) => {
    const url = String(input);
    if (url.includes('/api/pricing/guest-breakdown')) {
      // Weekend (Fri+Sat) 2-night quote: standard 13,128, 25% direct discount, all-in 10,141.
      return json({
        baseAmount: 13128,
        discountAmount: 3282,
        convenienceFeeAmount: 295,
        finalAmount: 10141,
      });
    }
    if (url.includes('/api/pricing/daily-summary')) {
      return json({
        listings: [{ listingId: 7, listingName: 'Penthouse', baseAmount: 5998, discountAmount: 1499, finalAmount: 4633, convenienceFeePercent: 3, globalDiscountPercent: 25 }],
      });
    }
    return json({ availableListingIds: [7] });
  });
});

function renderAt(url: string) {
  return render(
    <CurrencyProvider>
      <MemoryRouter initialEntries={[url]}>
        <SearchPage />
      </MemoryRouter>
    </CurrencyProvider>,
  );
}

describe('SearchPage card price for the searched stay (GUEST-034)', () => {
  it('fetches the guest-breakdown for the searched dates and guests and shows its exact all-in total', async () => {
    renderAt('/search?checkIn=2026-11-06&checkOut=2026-11-08&guests=3');
    await settle();

    const quoteCalls = mockFetch.mock.calls.map(urlOf).filter((u) => u.includes('/api/pricing/guest-breakdown'));
    expect(quoteCalls).toHaveLength(1);
    expect(quoteCalls[0]).toContain('listingId=7');
    expect(quoteCalls[0]).toContain('checkIn=2026-11-06');
    expect(quoteCalls[0]).toContain('checkOut=2026-11-08');
    expect(quoteCalls[0]).toContain('guests=3');

    const card = screen.getByTestId('guest-listing-card');
    // 13,128 / 2 = 6,564 struck; (13,128 - 3,282) / 2 = 4,923 real per night; total is the quote's 10,141, not 4,923 x 2.
    expect(card).toHaveTextContent(/6,564/);
    expect(card).toHaveTextContent(/25% off/);
    expect(screen.getByTestId('guest-listing-nightly-price')).toHaveTextContent(/4,923/);
    expect(screen.getByTestId('guest-listing-stay-total')).toHaveTextContent(/10,141 total · 2 nights · all fees included/);
    expect(card).not.toHaveTextContent(/4,499/);
  });

  it('without dates keeps tonight price and makes no guest-breakdown request', async () => {
    renderAt('/search');
    await settle();

    expect(mockFetch.mock.calls.map(urlOf).some((u) => u.includes('/api/pricing/guest-breakdown'))).toBe(false);
    expect(screen.getByTestId('guest-listing-nightly-price')).toHaveTextContent(/4,499/);
    expect(screen.queryByTestId('guest-listing-stay-total')).not.toBeInTheDocument();
  });
});
