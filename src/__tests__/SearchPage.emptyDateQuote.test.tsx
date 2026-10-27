/**
 * TASK-10299183: Empty-state suggestion cards calculate price for searched dates & gateway flag.
 * Suggestion cards compute and display the rate for the guest's actual searched dates and guest count.
 * Also verifies the online checkout / payment gateway availability flag on suggestion cards and listing cards.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrencyProvider } from '../contexts/CurrencyContext';
import { clearMarketplaceCardPriceCache } from '../hooks/useMarketplaceCardPrices';
import SearchPage from '../pages/SearchPage';
import { settle } from '../test/settle';

const mockFetchPublicListings = vi.fn();
vi.mock('../api/listingClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/listingClient')>();
  return {
    ...actual,
    fetchPublicListings: (...args: unknown[]) => mockFetchPublicListings(...args),
  };
});

vi.mock('../runtime-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime-config')>();
  return {
    ...actual,
    getApiBaseUrl: () => 'https://api.example.com',
    getGlobalDiscountPercent: () => 0,
  };
});

// A host with an online payment gateway
vi.mock('../tenant/paymentRail', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../tenant/paymentRail')>()),
  hasOnlinePaymentRail: () => true,
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  mockFetch.mockReset();
  clearMarketplaceCardPriceCache();
  mockFetchPublicListings.mockReset();

  mockFetchPublicListings.mockResolvedValue([
    { id: 201, name: 'Riverside Cottage', maxGuests: 4, baseNightlyRate: 3500 },
    { id: 202, name: 'Hilltop Chalet', maxGuests: 6, baseNightlyRate: 5000 },
  ]);

  mockFetch.mockImplementation((input: unknown) => {
    const url = String(input);
    if (url.includes('/api/pricing/guest-breakdown')) {
      if (url.includes('listingId=201')) {
        return json({
          baseAmount: 8000,
          discountAmount: 1000,
          convenienceFeeAmount: 210,
          finalAmount: 7210,
        });
      }
      return json({
        baseAmount: 12000,
        discountAmount: 1200,
        convenienceFeeAmount: 324,
        finalAmount: 11124,
      });
    }
    if (url.includes('/api/pricing/daily-summary')) {
      return json({
        listings: [
          { listingId: 201, listingName: 'Riverside Cottage', baseAmount: 3500, discountAmount: 0, finalAmount: 3500, convenienceFeePercent: 3, globalDiscountPercent: 0 },
          { listingId: 202, listingName: 'Hilltop Chalet', baseAmount: 5000, discountAmount: 0, finalAmount: 5000, convenienceFeePercent: 3, globalDiscountPercent: 0 },
        ],
      });
    }
    return json({ availableListingIds: [201, 202] });
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

describe('SearchPage empty-state suggestion cards price for searched dates (TASK-10299183)', () => {
  it('computes and displays the rate for the guest actual searched dates and shows online checkout chip', async () => {
    // Filter with minPrice=999999 to trigger empty state while searched dates are present
    renderAt('/search?checkIn=2026-11-10&checkOut=2026-11-12&guests=2&minPrice=999999');
    await settle();

    expect(screen.getByTestId('search-empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('search-empty-suggestions')).toBeInTheDocument();

    const suggestionCards = screen.getAllByTestId('search-empty-suggestion-card');
    expect(suggestionCards).toHaveLength(2);

    // Suggestion card for 201: base 8000 - 1000 discount = 7000 / 2 nights = 3500/night, total 7210
    const totals = screen.getAllByTestId('search-suggestion-total');
    expect(totals[0]).toHaveTextContent(/7,210.*total/i);

    // Online checkout chips are rendered
    const paymentChips = screen.getAllByTestId('search-suggestion-online-payment-chip');
    expect(paymentChips.length).toBeGreaterThanOrEqual(1);
    expect(paymentChips[0]).toHaveTextContent('Online checkout');
  });

  it('surfaces online checkout chip on regular search result cards when online payment is available', async () => {
    renderAt('/search');
    await settle();

    const listingPaymentChips = screen.getAllByTestId('search-listing-online-payment-chip');
    expect(listingPaymentChips.length).toBe(2);
    expect(listingPaymentChips[0]).toHaveTextContent('Online checkout');
  });
});
