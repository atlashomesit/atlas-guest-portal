import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { CurrencyProvider } from '../contexts/CurrencyContext';
import SearchPage from '../pages/SearchPage';
import { settle } from '../test/settle';

vi.mock('../api/listingClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/listingClient')>();
  return {
    ...actual,
    fetchPublicListings: vi.fn(() => Promise.reject(new Error('network'))),
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

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('SearchPage — Category & Amenity URL sync and Sort control (TASK-1039950, TASK-1039952, TASK-1039951)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));
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

  it('TASK-1039950: restores category and amenities from URL query parameters', async () => {
    renderAt('/search?category=homes&amenities=Pool');
    await settle();

    // Active category filter chip in active chips strip
    const chipStrip = screen.getByTestId('search-active-filter-chips');
    expect(chipStrip).toHaveTextContent(/Category: Homes/i);
    expect(chipStrip).toHaveTextContent(/Pool/i);

    // Category button is pressed
    const homesBtn = screen.getByTestId('marketplace-filter-homes');
    expect(homesBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('TASK-1039950: clicking category filter pill toggles selection', async () => {
    renderAt('/search');
    await settle();

    const villasBtn = screen.getByTestId('marketplace-filter-villas');
    fireEvent.click(villasBtn);
    await settle();

    const chipStrip = screen.getByTestId('search-active-filter-chips');
    expect(chipStrip).toHaveTextContent(/Category: Villas/i);
  });

  it('TASK-1039952: renders sort dropdown with data-testid="marketplace-sort-select" and required options', async () => {
    renderAt('/search');
    await settle();

    const sortSelect = screen.getByTestId('marketplace-sort-select') as HTMLSelectElement;
    expect(sortSelect).toBeInTheDocument();
    expect(sortSelect.value).toBe('recommended');

    const options = Array.from(sortSelect.options).map((o) => o.textContent);
    expect(options).toContain('Recommended');
    expect(options).toContain('Price: Low to High');
    expect(options).toContain('Price: High to Low');
    expect(options).toContain('Top Rated');
  });

  it('TASK-1039952: restores sort order from URL query param', async () => {
    renderAt('/search?sort=price_asc');
    await settle();

    const sortSelect = screen.getByTestId('marketplace-sort-select') as HTMLSelectElement;
    expect(sortSelect.value).toBe('price_asc');
  });

  it('TASK-1039951: price filtering accepts minPrice and maxPrice query parameters', async () => {
    renderAt('/search?minPrice=2000&maxPrice=8000');
    await settle();

    const chipStrip = screen.getByTestId('search-active-filter-chips');
    expect(chipStrip).toHaveTextContent(/₹2,000–₹8,000\/night/i);
  });

  it('TASK-1040101: dated marketplace search skips single-tenant availability-batch and retains non-Atlas listings', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/marketplace/listings')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 676,
                tenantSlug: 'grove-and-co',
                title: 'The Estate by Grove & Co',
                city: 'Bengaluru',
                pricePerNight: 4500,
                maxGuests: 4,
                chargesOnlinePaymentFee: false,
              },
            ],
            total: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/api/pricing/guest-breakdown')) {
        return new Response(
          JSON.stringify({
            listingId: 676,
            currency: 'INR',
            baseAmount: 9000,
            discountAmount: 0,
            convenienceFeeAmount: 270,
            finalAmount: 9270,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      // If availability-batch were called, return only atlas IDs (1..7) to prove it is skipped
      if (url.includes('/api/public/listings/availability-batch')) {
        return new Response(
          JSON.stringify({ availableListingIds: [1, 2, 3] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderAt('/search?brand=atlastays&city=Bengaluru&checkIn=2026-12-10&checkOut=2026-12-12');
    await settle();

    // Non-Atlas listing 676 remains visible
    expect(await screen.findByText('The Estate by Grove & Co')).toBeInTheDocument();

    const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes('/marketplace/listings') && u.includes('checkIn=2026-12-10') && u.includes('checkOut=2026-12-12'))).toBe(true);
    expect(calledUrls.some((u) => u.includes('/api/public/listings/availability-batch'))).toBe(false);
    expect(calledUrls.some((u) => u.includes('/api/public/listings/availability-summary'))).toBe(false);
  });

  it('TASK-1040101: availableNow on marketplace search delegates today->tomorrow to /marketplace/listings and skips availability-batch', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/marketplace/listings')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 450,
                tenantSlug: 'mitali-saikia',
                title: 'Brahmaputra View Homestay',
                city: 'Guwahati',
                pricePerNight: 2800,
                maxGuests: 3,
              },
            ],
            total: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderAt('/search?brand=atlastays&availableNow=true');
    await settle();

    expect(await screen.findByText('Brahmaputra View Homestay')).toBeInTheDocument();
    const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
    const mpUrl = calledUrls.find((u) => u.includes('/marketplace/listings'));
    expect(mpUrl).toBeDefined();
    expect(mpUrl).toMatch(/checkIn=\d{4}-\d{2}-\d{2}/);
    expect(mpUrl).toMatch(/checkOut=\d{4}-\d{2}-\d{2}/);
    expect(calledUrls.some((u) => u.includes('/api/public/listings/availability-batch'))).toBe(false);
  });
});
