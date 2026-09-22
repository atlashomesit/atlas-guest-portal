// TASK-102058 — hero search bar must hydrate from URL params (Back-navigation retention)
// and performing a search must write the criteria back to the URL.
//
// RED before the fix: the `guests` total param (the only guest param the `/` homepage
// search writes) is ignored by the URL prefill, so Back-navigation resets Who to "2 guests".
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import AirbnbSearchBar from '../AirbnbSearchBar';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
}

const renderBarAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <AirbnbSearchBar />
      <LocationProbe />
    </MemoryRouter>,
  );

describe('TASK-102058 AirbnbSearchBar URL sync', () => {
  it('hydrates destination + dates + guest count from URL params (Back-navigation state)', async () => {
    renderBarAt('/?city=Goa&checkIn=2026-12-10&checkOut=2026-12-12&guests=4');

    // Destination restores into the Where input.
    await waitFor(() =>
      expect(screen.getByTestId('airbnb-search-destination')).toHaveValue('Goa'),
    );
    // Dates restore into the When trigger.
    expect(screen.getByTestId('airbnb-search-when')).toHaveTextContent(/10 Dec.*12 Dec/);
    // Guest TOTAL restores into the Who summary — the `/` search writes only `guests`,
    // never adults/children, so the prefill must honour it.
    await waitFor(() => expect(screen.getByText('4 guests')).toBeInTheDocument());
  });

  it('keeps adult/child breakdown when the URL carries it (/search form)', async () => {
    renderBarAt(
      '/search?destination=Goa&checkIn=2026-12-10&checkOut=2026-12-12&adults=3&children=1&infants=0&pets=0&guests=4',
    );

    await waitFor(() =>
      expect(screen.getByTestId('airbnb-search-destination')).toHaveValue('Goa'),
    );
    await waitFor(() => expect(screen.getByText('3 adults • 1 child')).toBeInTheDocument());
  });

  it('performing a search writes checkIn/checkOut/guests/city to the browser URL', async () => {
    renderBarAt('/?checkIn=2026-12-10&checkOut=2026-12-12&guests=4');

    // Destination is typed (not in the URL yet); dates + guests hydrate from the URL.
    fireEvent.change(screen.getByTestId('airbnb-search-destination'), { target: { value: 'Goa' } });
    await waitFor(() => expect(screen.getByText('4 guests')).toBeInTheDocument());

    fireEvent.submit(screen.getByTestId('airbnb-search-bar'));

    await waitFor(() => {
      const probe = screen.getByTestId('location-probe').textContent ?? '';
      const params = new URLSearchParams(probe.split('?')[1] ?? '');
      expect(params.get('city')).toBe('Goa');
      expect(params.get('checkIn')).toBe('2026-12-10');
      expect(params.get('checkOut')).toBe('2026-12-12');
      expect(params.get('guests')).toBe('4');
    });
  });

  it('does not clobber an in-progress guest edit when the URL carries no guest params', async () => {
    // Regression guard: the prefill effect must not reset Who to defaults on mount
    // when the URL has no guest criteria at all.
    renderBarAt('/?city=Goa');

    await waitFor(() =>
      expect(screen.getByTestId('airbnb-search-destination')).toHaveValue('Goa'),
    );
    expect(screen.getByText('2 guests')).toBeInTheDocument();
  });
});
