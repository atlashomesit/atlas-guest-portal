/**
 * TASK-1451: Search empty state — copy, Clear filters, and "you might also like" suggestions.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { CurrencyProvider } from '../contexts/CurrencyContext';
import SearchPage from '../pages/SearchPage';

vi.mock('../api/listingClient', () => ({
  fetchPublicListings: vi.fn(() => Promise.reject(new Error('network'))),
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

describe('SearchPage — empty state (TASK-1451)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));
  });

  it('shows empty copy, Clear filters, suggestions; clearing restores results', async () => {
    render(
      <CurrencyProvider>
        <MemoryRouter initialEntries={['/search?minPrice=999999999']}>
          <SearchPage />
        </MemoryRouter>
      </CurrencyProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('search-empty-state')).toBeInTheDocument();
      },
      { timeout: 15_000 },
    );

    expect(screen.getByRole('heading', { name: /no homestays match your filters/i })).toBeInTheDocument();
    expect(screen.getByText(/try adjusting dates, price range, or guest count/i)).toBeInTheDocument();
    expect(screen.getByTestId('search-empty-clear-filters')).toBeInTheDocument();
    expect(screen.getByTestId('search-empty-suggestions')).toBeInTheDocument();
    expect(screen.getAllByTestId('search-empty-suggestion-card')).toHaveLength(3);

    fireEvent.click(screen.getByTestId('search-empty-clear-filters'));

    await waitFor(
      () => {
        expect(screen.getByTestId('guest-search-results')).toBeInTheDocument();
      },
      { timeout: 15_000 },
    );
    expect(screen.queryByTestId('search-empty-state')).not.toBeInTheDocument();
  });
});
