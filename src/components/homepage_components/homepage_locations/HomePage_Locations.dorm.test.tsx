import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomePage_Locations from './HomePage_Locations';
import { settle } from '../../../test/settle';
import { CurrencyProvider } from '../../../contexts/CurrencyContext';
import * as useTenantListingsModule from '../../../hooks/useTenantListings';

// TASK-1040089: the guest storefront "Our Homes" tiles carry the same dorm / gender chips and per-bed wording as the listing card.
afterEach(() => {
  vi.restoreAllMocks();
});

const listings = [
  { id: '1516', title: 'Female Dorm' },
  { id: '1517', title: 'Private Room' },
];

const spyProperties = (properties: Array<Record<string, unknown>>) =>
  vi.spyOn(useTenantListingsModule, 'useTenantListings').mockReturnValue({
    listings: [] as never,
    properties: properties as never,
    state: 'success',
    fetchErrorMessage: null,
    refetch: vi.fn(),
  });

const renderTiles = () =>
  render(
    <CurrencyProvider>
      <MemoryRouter>
        <HomePage_Locations listings={listings} />
      </MemoryRouter>
    </CurrencyProvider>,
  );

describe('HomePage_Locations dorm tiles (TASK-1040089)', () => {
  it('shows the dorm badge and the Female-Only chip on a FemaleOnly dorm tile, and nothing on a private room', async () => {
    spyProperties([
      { id: '1516', listingId: 1516, property_name: 'Female Dorm', accommodationType: 'HostelDorm', dormGenderPolicy: 'FemaleOnly' },
      { id: '1517', listingId: 1517, property_name: 'Private Room', accommodationType: 'PrivateRoom', dormGenderPolicy: null },
    ]);

    renderTiles();
    await settle();

    const badges = screen.getAllByTestId('hostel-dorm-container');
    expect(badges).toHaveLength(1);
    expect(within(badges[0]).getByTestId('hostel-dorm-base-badge')).toHaveTextContent(/sold by the bed/i);
    expect(within(badges[0]).getByTestId('hostel-gender-badge-female')).toHaveTextContent(/female-only dorm/i);
  });

  it('renders no gender chip when the API states no rule (never guessed from the name)', async () => {
    spyProperties([
      { id: '1516', listingId: 1516, property_name: 'Female Dorm', accommodationType: 'HostelDorm', dormGenderPolicy: null },
    ]);

    renderTiles();
    await settle();

    expect(screen.getByTestId('hostel-dorm-base-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('hostel-gender-badge-female')).toBeNull();
  });

  it('prices a dorm tile per bed', async () => {
    spyProperties([
      { id: '1516', listingId: 1516, property_name: 'Female Dorm', accommodationType: 'HostelDorm', dormGenderPolicy: 'Mixed' },
      { id: '1517', listingId: 1517, property_name: 'Private Room', accommodationType: 'PrivateRoom', dormGenderPolicy: null },
    ]);
    renderTiles();
    await settle();

    // G2 journey 19: a card's accessible name is its own text now (it started with an aria-label that hid the words on screen).
    const tiles = screen.getAllByRole('link').filter((t) => t.classList.contains('property-card'));
    const dorm = tiles.find((t) => /female dorm/i.test(t.textContent ?? ''));
    const room = tiles.find((t) => /private room/i.test(t.textContent ?? ''));
    expect(dorm).toBeTruthy();
    expect(room).toBeTruthy();
    expect(dorm).toHaveTextContent(/per bed/i);
    expect(dorm).not.toHaveTextContent(/per night/i);
    expect(room).toHaveTextContent(/per night/i);
    expect(room).not.toHaveTextContent(/per bed/i);
  });
});
