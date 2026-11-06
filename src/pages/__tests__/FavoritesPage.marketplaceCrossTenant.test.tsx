import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestAuthContext, type GuestAuthState } from '@/contexts/GuestAuthContext';
import { BookingProvider, useBooking } from '@/contexts/BookingContext';
import { setDomainResolvedSlug } from '@/tenant/tenantResolver';
import { settle } from '@/test/settle';
import FavoritesPage from '../FavoritesPage';
import Reserve from '../Reserve';
import { useEffect } from 'react';

vi.mock('@/components/SEO', () => ({ default: () => null }));
vi.mock('@/tenant/displayBrand', () => ({ getTenantBrandName: () => 'Atlastays' }));
vi.mock('@/api/listingClient', () => ({
  fetchPublicListings: vi.fn(async () => [{ id: 101, name: 'Atlas Penthouse', baseNightlyRate: 3200 }]),
}));
vi.mock('@/utils/guestHistory', () => ({
  getFavoriteIds: () => [101, 502],
  getRecentlyViewed: () => [],
  toggleFavorite: vi.fn(),
}));
vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `http://api.test${path}`,
  getApiHeaders: () => ({ 'X-Tenant-Slug': 'atlas' }),
}));
vi.mock('@/hooks/useDailyPricingSummary', () => ({
  useDailyPricingSummary: () => ({ getListingPricing: () => null }),
}));
vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({ format: (n: number) => `₹${n}`, formatINR: (n: number) => `₹${n}`, isConverted: false }),
}));

const signedOut: GuestAuthState = { isAuthenticated: false, token: null, email: null, guestId: null };

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location-probe">{loc.pathname + loc.search}</div>;
}

function SeededReserve() {
  const { booking, updateBooking } = useBooking();
  useEffect(() => {
    updateBooking({
      propertyName: 'Kashi Heritage Villa',
      listingDetailPath: '/homes/kashi-heritage-villa/502?tenant=kashi-villa&brand=atlastays',
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      guests: 3,
    });
  }, [updateBooking]);
  if (!booking.listingDetailPath) return null;
  return <Reserve />;
}

describe('TASK-1040103 marketplace cross-tenant Favorites & Reserve navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    setDomainResolvedSlug('atlas');
  });

  it('resolves saved cross-tenant marketplace listings missing from single-tenant fetchPublicListings and preserves ?tenant= on card links', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/marketplace/listings')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 502,
                tenantSlug: 'kashi-villa',
                title: 'Kashi Heritage Villa',
                displayName: 'Kashi Heritage Villa',
                city: 'Varanasi',
                pricePerNight: 4800,
                maxGuests: 6,
                coverImageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/favorites?brand=atlastays']}>
        <GuestAuthContext.Provider value={{ auth: signedOut, isLoading: false, login: vi.fn(), logout: vi.fn() }}>
          <FavoritesPage />
        </GuestAuthContext.Provider>
      </MemoryRouter>
    );

    await settle();
    expect(screen.getByText('Kashi Heritage Villa')).toBeInTheDocument();

    const cardLink = screen.getByRole('link', { name: /View Kashi Heritage Villa/i });
    expect(cardLink.getAttribute('href')).toContain('/homes/kashi-heritage-villa/502?tenant=kashi-villa&brand=atlastays');
  });

  it('appends checkIn, checkOut, and guests cleanly in Reserve without creating a duplicate ? when listingDetailPath has ?tenant=', async () => {
    render(
      <MemoryRouter initialEntries={['/reserve']}>
        <BookingProvider>
          <SeededReserve />
          <LocationProbe />
        </BookingProvider>
      </MemoryRouter>
    );

    await settle();
    expect(screen.getByText('Kashi Heritage Villa')).toBeInTheDocument();

    const continueBtn = screen.getByRole('button', { name: /Continue to booking/i });
    fireEvent.click(continueBtn);
    await settle();

    const target = screen.getByTestId('location-probe').textContent ?? '';
    expect(target).toBe(
      '/homes/kashi-heritage-villa/502?tenant=kashi-villa&brand=atlastays&checkIn=2026-12-10&checkOut=2026-12-12&guests=3'
    );
  });
});
