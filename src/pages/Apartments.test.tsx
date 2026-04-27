import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../components/apartments/ListingCard', () => ({
  __esModule: true,
  default: () => <div data-testid="listing-card" />,
}));

vi.mock('../components/apartments/ListingFilters', () => ({
  __esModule: true,
  default: () => <div data-testid="listing-filters" />,
}));

vi.mock('../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../api/listingClient', () => ({
  fetchPublicListings: vi.fn(() => Promise.reject(new Error('network fail'))),
}));

vi.mock('../runtime-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime-config')>();
  return {
    ...actual,
    getApiBaseUrl: () => 'https://api.example.com',
    getGlobalDiscountPercent: () => 0,
  };
});

import { fetchPublicListings } from '../api/listingClient';
import { Apartments } from './Apartments';

describe('Apartments', () => {
  it('shows the shared error layout when fetching listings fails', async () => {
    render(
      <MemoryRouter>
        <Apartments />
      </MemoryRouter>
    );

    await waitFor(() => expect(fetchPublicListings).toHaveBeenCalled());

    // Async fetch + setState; release gate runs guest tests in parallel with API/admin — allow extra time
    await waitFor(
      () => {
        expect(screen.getByTestId('error-layout')).toBeInTheDocument();
      },
      { timeout: 10_000 },
    );
    expect(screen.getByText(/we couldn’t load this page/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });
});
