/**
 * TASK-1456: Active filter chips + badge on SearchPage.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { CurrencyProvider } from '../contexts/CurrencyContext';
import SearchPage from '../pages/SearchPage';
import { settle } from '../test/settle';

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

    await settle();
    expect(screen.getByTestId('search-active-filter-badge')).toHaveTextContent('3');

    const chipStrip = screen.getByTestId('search-active-filter-chips');
    expect(chipStrip).toBeInTheDocument();
    expect(chipStrip).toHaveTextContent(/min ₹1,?000\/night/i);
    expect(chipStrip).toHaveTextContent(/2 guests/i);
    expect(chipStrip).toHaveTextContent('WiFi');

    fireEvent.click(screen.getByRole('button', { name: /^Remove filter WiFi$/i }));

    await settle();
    expect(screen.getByTestId('search-active-filter-badge')).toHaveTextContent('2');
    expect(screen.getByTestId('search-active-filter-chips')).not.toHaveTextContent('WiFi');
  });

  it('TASK-102077: one click on "Clear filters" resets every filter and removes the badge', async () => {
    render(
      <CurrencyProvider>
        <MemoryRouter initialEntries={['/search?minPrice=1000&guests=2&amenities=WiFi']}>
          <SearchPage />
        </MemoryRouter>
      </CurrencyProvider>,
    );

    await settle();
    expect(screen.getByTestId('search-active-filter-badge')).toHaveTextContent('3');

    fireEvent.click(screen.getByRole('button', { name: /^clear filters$/i }));

    // Single click clears all: badge + chip strip disappear together.
    await settle();
    expect(screen.queryByTestId('search-active-filter-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-active-filter-chips')).not.toBeInTheDocument();
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

  it('qa-scout: removing the guests chip clears a marketplace adults/children search', async () => {
    renderAt('/search?adults=2&children=1&guests=3');
    await settle();
    expect(screen.getByTestId('search-active-filter-chips')).toHaveTextContent(/3 guests/i);

    fireEvent.click(screen.getByRole('button', { name: /^Remove filter 3 guests$/i }));
    await settle();
    expect(screen.queryByTestId('search-active-filter-chips')).not.toBeInTheDocument();
  });

  it('qa-scout: editing the Guests box overrides a marketplace adults/children search', async () => {
    renderAt('/search?adults=2&children=1&guests=3');
    await settle();

    fireEvent.change(screen.getByLabelText('Guests'), { target: { value: '2' } });
    await settle();
    expect(screen.getByLabelText('Guests')).toHaveValue(2);
    expect(screen.getByTestId('search-active-filter-chips')).toHaveTextContent(/2 guests/i);
  });

  it('qa-scout: "Clear filters" also clears a marketplace adults/children search', async () => {
    renderAt('/search?adults=2&children=1&guests=3');
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /^clear filters$/i }));
    await settle();
    expect(screen.queryByTestId('search-active-filter-chips')).not.toBeInTheDocument();
  });

  it('qa-scout: a negative guests param is ignored, not shown as a filter', async () => {
    renderAt('/search?guests=-2');
    await settle();
    expect(screen.queryByTestId('search-active-filter-chips')).not.toBeInTheDocument();
  });
});
