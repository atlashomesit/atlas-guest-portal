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
});
