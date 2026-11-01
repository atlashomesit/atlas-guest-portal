import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HeritagePropertyDetails from '../heritage/PropertyDetails';
import { settle } from '../../test/settle';
import {
  _setListingTenantContextForTests,
  _clearListingTenantCacheForTests,
} from '@/tenant/tenantContext';
import { _resetTenantResolutionForTests } from '@/tenant/tenantResolver';

vi.mock('@/components/availability/UnitBookingWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-booking-widget">UnitBookingWidget</div>,
}));
vi.mock('@/components/AvailabilityCalendar', () => ({
  __esModule: true,
  default: () => <div>Availability Calendar</div>,
}));
vi.mock('@/components/GuestAssistant', () => ({
  __esModule: true,
  default: () => <div>Guest Assistant</div>,
}));
vi.mock('@/utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/utils/pricing', () => ({
  calculateNightlyPrice: vi.fn(() => ({ finalNightlyPrice: 1000 })),
  inferUnitType: vi.fn(() => 'test-unit'),
}));
vi.mock('@/contexts/BookingContext', () => ({
  useBooking: () => ({
    booking: { propertyId: null, checkIn: null, checkOut: null, guests: 4 },
    setProperty: vi.fn(),
    setPendingScrollTarget: vi.fn(),
    updateBooking: vi.fn(),
    setDates: vi.fn(),
    setGuests: vi.fn(),
    pendingScrollTarget: null,
  }),
  BookingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@fancyapps/ui', () => ({
  Fancybox: { bind: vi.fn(), destroy: vi.fn(), show: vi.fn() },
}));

const mockFetchListingById = vi.fn();
const mockFetchSimilarListings = vi.fn();
vi.mock('@/api/listingClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/listingClient')>();
  return {
    ...actual,
    fetchListingById: (...args: unknown[]) => mockFetchListingById(...args),
    fetchSimilarListings: (...args: unknown[]) => mockFetchSimilarListings(...args),
    fetchPublicListings: vi.fn().mockResolvedValue([]),
    fetchAllActiveListings: vi.fn().mockResolvedValue([]),
  };
});

const mockResolveListing = vi.fn();
vi.mock('@/utils/listingResolver', () => ({
  resolveListing: (...args: unknown[]) => mockResolveListing(...args),
}));

const mockUseTenantListings = vi.fn();
vi.mock('@/hooks/useTenantListings', () => ({
  useTenantListings: () => mockUseTenantListings(),
}));

const LIST_ROW = {
  id: 450,
  listingId: 450,
  propertyName: 'Comfort Cove',
  property_name: 'Comfort Cove',
  property_location: 'Guwahati, Assam',
  property_img: ['https://cdn.example.com/cove1.jpg'],
  property_amenities: [],
  property_description: 'Cozy stay in Guwahati',
  property_price: 4000,
  property_rating: 4.8,
  property_reviews: 12,
  checkInTime: '14:00',
  checkOutTime: '11:00',
  status: 'Published',
};

describe('Heritage PropertyDetails — TASK-1040085 & GUEST-051', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearListingTenantCacheForTests();
    _resetTenantResolutionForTests();
    mockUseTenantListings.mockReturnValue({ listings: [], properties: [LIST_ROW], state: 'success', refetch: vi.fn() });
    mockResolveListing.mockReturnValue(LIST_ROW);
    mockFetchListingById.mockResolvedValue(LIST_ROW);
    mockFetchSimilarListings.mockResolvedValue([
      { id: 451, propertyName: 'Compact Room', property_price: 2200, maxGuests: 2, property_rating: 3.5, property_reviews: 3 },
      { id: 452, propertyName: 'Heritage Suite', property_price: 5500, maxGuests: 4, property_rating: 4.7, property_reviews: 9 },
    ]);
  });

  afterEach(() => {
    cleanup();
    _clearListingTenantCacheForTests();
    _resetTenantResolutionForTests();
  });

  it('preserves ?brand=atlastays & utm_* on back links and renders enriched Similar stays sorted for party size', async () => {
    _setListingTenantContextForTests('atlas', {
      slug: 'atlas',
      name: 'Atlas Homes',
      brandName: 'Atlas Homes',
      bookingMode: 'ONLINE',
      paymentProvider: 'RAZORPAY',
      whatsappBookingPhone: '9502244053',
    });

    render(
      <MemoryRouter initialEntries={['/homes/comfort-cove/450?tenant=atlas&brand=atlastays&utm_source=meta&utm_campaign=monsoon']}>
        <Routes>
          <Route path="/homes/:propertySlug/:unitSlug" element={<HeritagePropertyDetails />} />
        </Routes>
      </MemoryRouter>,
    );
    await settle();

    for (const testId of ['back-to-results', 'back-to-all-listings', 'back-to-results-btn']) {
      const href = screen.getByTestId(testId).getAttribute('href') ?? '';
      expect(href).toContain('brand=atlastays');
      expect(href).toContain('utm_source=meta');
      expect(href).toContain('utm_campaign=monsoon');
    }

    const prices = screen.getAllByTestId('similar-stay-price');
    expect(prices[0].textContent).toContain('from ₹5,500 / night');
    expect(prices[1].textContent).toContain('from ₹2,200 / night');
    expect(screen.getAllByTestId('similar-stay-rating')).toHaveLength(1);
  });
});
