/**
 * TASK-8351: "Available tonight" must hit availability-batch once, never the
 * 40-wide listing-availability fan-out, and must fail-open on a 500.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { CurrencyProvider } from '../contexts/CurrencyContext';
import SearchPage from '../pages/SearchPage';

const mockFetchPublicListings = vi.fn();
vi.mock('../api/listingClient', () => ({
  fetchPublicListings: (...args: unknown[]) => mockFetchPublicListings(...args),
}));

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

function fortyListings() {
  return Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    name: `Stay ${i + 1}`,
    title: `Stay ${i + 1}`,
    maxGuests: 2,
    baseNightlyRate: 3000,
  }));
}

function availabilityCalls() {
  return mockFetch.mock.calls.filter((args) => {
    const url = String(args[0] ?? '');
    return url.includes('/availability');
  });
}

describe('SearchPage — Available tonight (TASK-8351)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetchPublicListings.mockReset();
    mockFetchPublicListings.mockResolvedValue(fortyListings());
  });

  it('issues exactly one availability-batch request for a 40-listing set', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ availableListingIds: [1, 2, 3] }),
    });

    render(
      <CurrencyProvider>
        <MemoryRouter initialEntries={['/search?availableNow=true']}>
          <SearchPage />
        </MemoryRouter>
      </CurrencyProvider>,
    );

    await waitFor(() => {
      const avail = availabilityCalls();
      expect(avail).toHaveLength(1);
      expect(String(avail[0][0])).toContain('/api/public/listings/availability-batch');
      expect(String(avail[0][0])).not.toContain('listing-availability');
    });
  });

  it('fail-open: a 500 from the batch leaves listings visible', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    render(
      <CurrencyProvider>
        <MemoryRouter initialEntries={['/search?availableNow=true']}>
          <SearchPage />
        </MemoryRouter>
      </CurrencyProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('guest-search-results')).toBeInTheDocument();
    });
    // Fail-open: a 500 must not empty the grid. SearchPage paginates (visibleCount),
    // so assert cards remain rather than requiring all 40 titles in the DOM.
    expect(screen.getAllByTestId('guest-listing-card').length).toBeGreaterThan(0);
    expect(screen.getByText('Stay 1')).toBeInTheDocument();
  });
});
