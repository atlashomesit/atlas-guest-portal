/**
 * GUEST-033: a 1-2 guest search must not land on the 7-guest penthouse with no hint that smaller homes
 * cost less. Homes sized for the party come first, the big home says who it suits and links to the
 * cheapest small home. No change for 3+ guests.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { CurrencyProvider } from '../contexts/CurrencyContext';
import { clearMarketplaceCardPriceCache } from '../hooks/useMarketplaceCardPrices';
import SearchPage from '../pages/SearchPage';
import { settle } from '../test/settle';

vi.mock('../api/listingClient', () => ({
  fetchPublicListings: vi.fn(() =>
    Promise.resolve([
      { id: 1, name: 'Penthouse 501', title: 'Penthouse 501', maxGuests: 7, baseNightlyRate: 5998 },
      { id: 2, name: 'Flat A', title: 'Flat A', maxGuests: 3, baseNightlyRate: 3528 },
      { id: 3, name: 'Flat B', title: 'Flat B', maxGuests: 4, baseNightlyRate: 3457 },
    ]),
  ),
}));

vi.mock('../runtime-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime-config')>();
  return { ...actual, getApiBaseUrl: () => 'https://api.example.com', getGlobalDiscountPercent: () => 0 };
});

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  mockFetch.mockReset();
  clearMarketplaceCardPriceCache();
  mockFetch.mockImplementation((input: unknown) => {
    const url = String(input);
    if (url.includes('/api/pricing/daily-summary')) {
      return json({
        listings: [
          { listingId: 1, listingName: 'Penthouse 501', baseAmount: 5998, discountAmount: 1499, finalAmount: 4499, convenienceFeePercent: 0, globalDiscountPercent: 25 },
          { listingId: 2, listingName: 'Flat A', baseAmount: 3528, discountAmount: 882, finalAmount: 2646, convenienceFeePercent: 0, globalDiscountPercent: 25 },
          { listingId: 3, listingName: 'Flat B', baseAmount: 3457, discountAmount: 864, finalAmount: 2593, convenienceFeePercent: 0, globalDiscountPercent: 25 },
        ],
      });
    }
    return json({ availableListingIds: [1, 2, 3] });
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

const titles = () => screen.getAllByTestId('guest-listing-card').map((c) => c.querySelector('h2')?.textContent);

describe('SearchPage small-party hint (GUEST-033)', () => {
  it('for 2 guests lists homes sized for them first and hints the big home', async () => {
    renderAt('/search?guests=2');
    await settle();

    expect(titles()).toEqual(['Flat A', 'Flat B', 'Penthouse 501']);
    expect(screen.getByTestId('guest-listing-group-hint')).toHaveTextContent('Best for groups of 4–7');
    expect(screen.getAllByTestId('guest-listing-group-hint')).toHaveLength(1);
    expect(screen.getByTestId('guest-listing-small-homes-link')).toHaveTextContent(/See homes for two from .*2,593/);
  });

  it('the link sorts by price so the cheapest homes lead', async () => {
    renderAt('/search?guests=2');
    await settle();
    fireEvent.click(screen.getByTestId('guest-listing-small-homes-link'));
    await settle();
    expect(titles()?.[0]).toBe('Flat B');
  });

  it('for 3+ guests nothing changes', async () => {
    const base = renderAt('/search');
    await settle();
    const baseline = titles();
    base.unmount();
    renderAt('/search?guests=3');
    await settle();
    expect(screen.queryByTestId('guest-listing-group-hint')).not.toBeInTheDocument();
    expect(titles()).toEqual(baseline);
  });
});
