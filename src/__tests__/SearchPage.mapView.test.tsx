/**
 * TASK-1457: List / Map toggle on SearchPage (map chunk mocked — real map uses Leaflet context).
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

vi.mock('../components/search/SearchResultsMap', () => ({
  __esModule: true,
  default: () => (
    <div data-testid="search-results-map">
      <div data-testid="mock-leaflet-map" />
      <div data-testid="mock-map-marker" />
    </div>
  ),
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

describe('SearchPage — map view (TASK-1457)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));
  });

  it('switches to map layout and renders the map shell; list restores the grid', async () => {
    render(
      <CurrencyProvider>
        <MemoryRouter initialEntries={['/search']}>
          <SearchPage />
        </MemoryRouter>
      </CurrencyProvider>,
    );

    await settle();
    expect(screen.getByTestId('guest-search-results')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('search-view-map'));

    await settle();
    expect(screen.getByTestId('search-results-map')).toBeInTheDocument();

    expect(screen.getByTestId('mock-leaflet-map')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('search-view-list'));

    await settle();
    expect(screen.getByTestId('guest-search-results')).toBeInTheDocument();
    expect(screen.queryByTestId('search-results-map')).not.toBeInTheDocument();
  });
});
