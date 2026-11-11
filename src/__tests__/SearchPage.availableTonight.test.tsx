/**
 * TASK-8351: "Available tonight" must hit availability-batch once, never the
 * 40-wide listing-availability fan-out, and must fail-open on a 500.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { CurrencyProvider } from '../contexts/CurrencyContext';
import SearchPage from '../pages/SearchPage';
import { settle } from '../test/settle';

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

    // The mount effect issues the batch request inside render()'s act, so this snapshot needs no wait: it is the
    // moment the old waitFor passed at (its first synchronous check). Draining first would let the follow-up
    // /availability/summary call, made once the batch answers, match the '/availability' filter below - that is a
    // different request, not a second batch.
    const avail = availabilityCalls();
    expect(avail).toHaveLength(1);
    expect(String(avail[0][0])).toContain('/api/public/listings/availability-batch');
    expect(String(avail[0][0])).not.toContain('listing-availability');

    // Once everything has settled: still exactly one batch request, and never the per-listing fan-out.
    await settle();
    const urls = availabilityCalls().map((args) => String(args[0]));
    expect(urls.filter((u) => u.includes('/availability-batch'))).toHaveLength(1);
    expect(urls.filter((u) => u.includes('listing-availability'))).toHaveLength(0);
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

    await settle();
    expect(screen.getByTestId('guest-search-results')).toBeInTheDocument();
    // Fail-open: a 500 must not empty the grid. SearchPage paginates (visibleCount),
    // so assert cards remain rather than requiring all 40 titles in the DOM.
    expect(screen.getAllByTestId('guest-listing-card').length).toBeGreaterThan(0);
    expect(screen.getByText('Stay 1')).toBeInTheDocument();
  });
});
