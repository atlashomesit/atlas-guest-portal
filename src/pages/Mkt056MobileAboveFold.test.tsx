import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BookingProvider } from '@/contexts/BookingContext';
import AirbnbSearchBar from '@/components/marketplace/airbnbSearch/AirbnbSearchBar';
import CityLandingPage from './CityLandingPage';

vi.mock('@/api/publicCities', () => ({
  fetchPublicCities: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/api/publicListings', () => ({
  fetchPublicListings: vi.fn().mockResolvedValue([
    {
      id: 101,
      name: 'Banjara Hills Villa',
      title: 'Banjara Hills Villa',
      displayName: 'Banjara Hills Villa',
      city: 'Hyderabad',
      location: 'Hyderabad',
      pricePerNight: 3500,
      maxGuests: 4,
      coverImageUrl: 'https://example.com/villa.jpg',
    },
  ]),
}));

vi.mock('@/tenant/tenantResolver', () => ({
  isMarketplaceMode: vi.fn().mockReturnValue(false),
  isAtlastaysMarketplaceSurface: vi.fn().mockReturnValue(false),
  getTenantContext: vi.fn().mockReturnValue({ slug: 'atlashomestays' }),
}));

describe('MKT-056: mobile above-the-fold layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 101,
            name: 'Banjara Hills Villa',
            title: 'Banjara Hills Villa',
            displayName: 'Banjara Hills Villa',
            city: 'Hyderabad',
            location: 'Hyderabad',
            property: { address: 'Banjara Hills, Hyderabad' },
            pricePerNight: 3500,
            maxGuests: 4,
            coverImageUrl: 'https://example.com/villa.jpg',
          },
        ],
      }),
    );
  });

  it('renders compact mobile pill on AirbnbSearchBar when compactMobile is true and expands on tap', () => {
    render(
      <MemoryRouter>
        <AirbnbSearchBar compactMobile />
      </MemoryRouter>,
    );

    const pill = screen.getByTestId('airbnb-search-mobile-pill');
    expect(pill).toBeTruthy();
    expect(pill.textContent).toContain('Where');
    expect(pill.textContent).toContain('Any dates');
    expect(pill.textContent).toContain('2 guests');

    fireEvent.click(pill);

    expect(screen.queryByTestId('airbnb-search-mobile-pill')).toBeNull();
    expect(screen.getByTestId('airbnb-search-mobile-collapse')).toBeTruthy();

    fireEvent.click(screen.getByTestId('airbnb-search-mobile-collapse'));
    expect(screen.getByTestId('airbnb-search-mobile-pill')).toBeTruthy();
  });

  it('renders city-landing-listings before editorial guide prose on CityLandingPage', async () => {
    render(
      <BookingProvider>
        <MemoryRouter initialEntries={['/homestays-in-hyderabad']}>
          <CityLandingPage citySlug="hyderabad" />
        </MemoryRouter>
      </BookingProvider>,
    );

    const listings = await waitFor(() => screen.getByTestId('city-landing-listings'));
    const guide = screen.getByTestId('city-landing-guide');

    // Node.DOCUMENT_POSITION_FOLLOWING (4) means `guide` follows `listings` in DOM order.
    expect(listings.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
