/**
 * TASK-10086: Accessibility needs filter group on SearchPage.
 * Declared listings match the filter; undeclared listings stay discoverable
 * without it and are never labelled accessible.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { CurrencyProvider } from '../contexts/CurrencyContext';
import SearchPage from '../pages/SearchPage';
import type { PublicListing } from '../api/listingClient';
import { settle } from '../test/settle';

const declared: PublicListing = {
  id: 100861,
  name: 'Step-Free Villa',
  maxGuests: 4,
  baseNightlyRate: 5000,
  propertyAddress: 'Goa',
  photoUrls: [],
  amenityCodes: ['step_free_entrance', 'wifi'],
};

const undeclared: PublicListing = {
  id: 100862,
  name: 'Standard Room',
  maxGuests: 2,
  baseNightlyRate: 3000,
  propertyAddress: 'Goa',
  photoUrls: [],
  amenityCodes: ['wifi'],
};

const fetchPublicListings = vi.fn(() => Promise.resolve([declared, undeclared]));
vi.mock('../api/listingClient', () => ({
  fetchPublicListings: (...args: unknown[]) => fetchPublicListings(...args),
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

function renderSearch(initialEntry: string) {
  return render(
    <CurrencyProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <SearchPage />
      </MemoryRouter>
    </CurrencyProvider>,
  );
}

describe('SearchPage — accessibility needs filter (TASK-10086)', () => {
  beforeEach(() => {
    fetchPublicListings.mockClear();
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));
  });

  it('renders the Accessibility needs group with the v1 trio', async () => {
    renderSearch('/search');

    await settle();
    const group = screen.getByTestId('search-accessibility-filters');
    expect(group).toHaveTextContent(/accessibility needs/i);
    expect(group).toHaveTextContent(/step-free entrance/i);
    expect(group).toHaveTextContent(/lift\/elevator access/i);
    expect(group).toHaveTextContent(/accessible parking/i);
  });

  it('shows both listings without the filter and never labels the undeclared one accessible', async () => {
    renderSearch('/search');

    await settle();
    const cards = screen.getAllByTestId('guest-listing-card');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('Step-Free Villa')).toBeInTheDocument();
    expect(screen.getByText('Standard Room')).toBeInTheDocument();
    const standardCard = screen.getByText('Standard Room').closest('article');
    expect(standardCard?.textContent ?? '').not.toMatch(/accessible/i);
  });

  it('returns only declared listings when the filter is URL-selected', async () => {
    renderSearch('/search?amenities=step-free-entrance');

    await settle();
    expect(screen.getAllByTestId('guest-listing-card')).toHaveLength(1);
    expect(screen.getByText('Step-Free Villa')).toBeInTheDocument();
    expect(screen.queryByText('Standard Room')).not.toBeInTheDocument();
    expect(screen.getByTestId('search-active-filter-chips')).toHaveTextContent(/step-free entrance/i);
  });

  it('toggling a chip keeps the URL-backed filter state in sync', async () => {
    renderSearch('/search');

    await settle();
    screen.getAllByTestId('guest-listing-card');
    fireEvent.click(screen.getByRole('button', { name: /accessible parking/i }));

    await settle();
    expect(screen.getByTestId('search-active-filter-badge')).toHaveTextContent('1');
    expect(screen.getByTestId('search-active-filter-chips')).toHaveTextContent(/accessible parking/i);
    expect(screen.queryByTestId('guest-listing-card')).not.toBeInTheDocument();
  });
});
