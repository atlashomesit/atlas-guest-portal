/**
 * HSL-011 reachability (heritage theme): the listing API payload (GET /listings/{id}) is the only source of the
 * dorm facts, and the property-details page hands them to the booking widget.
 */
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense } from 'react';
import HeritagePropertyDetails from './PropertyDetails';
import { settle } from '../../test/settle';
import { _resetTenantContextForTests } from '@/tenant/tenantContext';

const mockUnitBookingWidget = vi.fn();
vi.mock('@/components/availability/UnitBookingWidget', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockUnitBookingWidget(props);
    return <div>Booking Widget</div>;
  },
}));
vi.mock('@/components/AvailabilityCalendar', () => ({ __esModule: true, default: () => <div>Availability Calendar</div> }));
vi.mock('@/components/GuestAssistant', () => ({ __esModule: true, default: () => <div>Guest Assistant</div> }));
vi.mock('@/components/homepage_components/hotelBooking_form/BookingCard.tsx', () => ({
  __esModule: true,
  default: () => <div id="booking-form">Booking Form</div>,
}));
vi.mock('@/utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/utils/pricing', () => ({
  calculateNightlyPrice: vi.fn(() => ({ finalNightlyPrice: 1000 })),
  inferUnitType: vi.fn(() => 'test-unit'),
}));
vi.mock('@/contexts/BookingContext', () => ({
  useBooking: () => ({
    booking: { propertyId: null, checkIn: null, checkOut: null, guests: 2 },
    setProperty: vi.fn(),
    setPendingScrollTarget: vi.fn(),
    updateBooking: vi.fn(),
    setDates: vi.fn(),
    setGuests: vi.fn(),
    pendingScrollTarget: null,
  }),
  BookingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@fancyapps/ui', () => ({ Fancybox: { bind: vi.fn(), destroy: vi.fn(), show: vi.fn() } }));

const mockFetchListingById = vi.fn();
vi.mock('@/api/listingClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/listingClient')>();
  return {
    ...actual,
    fetchListingById: (...args: unknown[]) => mockFetchListingById(...args),
    fetchPublicListings: vi.fn().mockResolvedValue([]),
  };
});
const mockResolveListing = vi.fn();
vi.mock('@/utils/listingResolver', () => ({
  resolveListing: (...args: unknown[]) => mockResolveListing(...args),
  resolveListingFromRoute: (...args: unknown[]) => mockResolveListing(...args),
}));
const mockUseTenantListings = vi.fn();
vi.mock('@/hooks/useTenantListings', () => ({ useTenantListings: () => mockUseTenantListings() }));

const renderPage = () => (
  <MemoryRouter initialEntries={['/homes/bunk-house/601']}>
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/homes/:propertySlug/:unitSlug" element={<HeritagePropertyDetails />} />
      </Routes>
    </Suspense>
  </MemoryRouter>
);

describe('Heritage PropertyDetails - HSL-011 dorm facts reach the booking widget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetTenantContextForTests();
    mockUseTenantListings.mockReturnValue({
      listings: [],
      properties: [
        {
          id: 601, listingId: 601, propertyName: 'Bunk House', property_name: '6-Bed Female-Only Dorm', property_location: 'Goa',
          property_img: ['https://cdn.example.com/b.jpg'], property_amenities: [], property_description: 'Hostel',
          property_rating: 5, property_reviews: 1, property_price: 799,
        },
      ],
      state: 'success',
      refetch: vi.fn(),
    });
    mockResolveListing.mockResolvedValue({ id: 601, propertyId: 601 });
  });

  it('passes accommodationType, dormGenderPolicy and the bed count from the listing payload', async () => {
    mockFetchListingById.mockResolvedValue({
      id: 601, accommodationType: 'HostelDorm', dormGenderPolicy: 'FemaleOnly', quantity: 6,
    });
    render(renderPage());
    await settle();
    await settle();
    expect(mockUnitBookingWidget).toHaveBeenCalledWith(
      expect.objectContaining({ accommodationType: 'HostelDorm', dormGenderPolicy: 'FemaleOnly', dormBedCount: 6 }),
    );
  });

  it('a dorm-looking NAME with no API dorm fields hands over nulls (no name guessing)', async () => {
    mockFetchListingById.mockResolvedValue({ id: 601 });
    render(renderPage());
    await settle();
    await settle();
    expect(mockUnitBookingWidget).toHaveBeenCalled();
    expect(mockUnitBookingWidget).not.toHaveBeenCalledWith(expect.objectContaining({ dormGenderPolicy: 'FemaleOnly' }));
    expect(mockUnitBookingWidget).toHaveBeenLastCalledWith(
      expect.objectContaining({ accommodationType: null, dormGenderPolicy: null, dormBedCount: null }),
    );
  });
});
