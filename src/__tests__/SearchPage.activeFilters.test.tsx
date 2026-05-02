/**
 * TASK-1456: Active filter chips + badge on SearchPage.
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

describe('SearchPage — active filter chips (TASK-1456)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));
  });

  it('shows badge and chips; removing one chip clears only that filter', async () => {
    render(
      <CurrencyProvider>
        <MemoryRouter initialEntries={['/search?minPrice=1000&guests=2&amenities=WiFi']}>
          <SearchPage />
        </MemoryRouter>
      </CurrencyProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('search-active-filter-badge')).toHaveTextContent('3');
      },
      { timeout: 15_000 },
    );

    const chipStrip = screen.getByTestId('search-active-filter-chips');
    expect(chipStrip).toBeInTheDocument();
    expect(chipStrip).toHaveTextContent(/min ₹1,?000\/night/i);
    expect(chipStrip).toHaveTextContent(/2 guests/i);
    expect(chipStrip).toHaveTextContent('WiFi');

    fireEvent.click(screen.getByRole('button', { name: /^Remove filter WiFi$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('search-active-filter-badge')).toHaveTextContent('2');
    });
    expect(screen.getByTestId('search-active-filter-chips')).not.toHaveTextContent('WiFi');
  });
});
