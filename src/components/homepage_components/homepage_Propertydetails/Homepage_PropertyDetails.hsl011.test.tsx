/**
 * HSL-011 reachability: the listing API payload (GET /listings/{id}) is the ONLY source of the dorm facts, and the
 * property-details page hands them to the booking widget. A listing with no dorm fields hands over nulls (no guessing
 * from a name such as "6-Bed Female-Only Dorm").
 */
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Suspense } from 'react';
import Homepage_PropertyDetails from './Homepage_PropertyDetails';
import { settle } from '../../../test/settle';
import { _clearListingTenantCacheForTests, _setTenantContextForTests } from '@/tenant/tenantContext';

const mockUnitBookingWidget = vi.fn();
vi.mock('@/components/availability/UnitBookingWidget', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockUnitBookingWidget(props);
    return <div data-testid="mock-booking-widget" />;
  },
}));
vi.mock('@/components/AvailabilityCalendar', () => ({ __esModule: true, default: () => <div>Availability Calendar</div> }));
vi.mock('@/components/GuestAssistant', () => ({ __esModule: true, default: () => <div>Guest Assistant</div> }));
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
    fetchAllActiveListings: vi.fn().mockResolvedValue([]),
  };
});

const mockResolveListing = vi.fn();
vi.mock('@/utils/listingResolver', () => ({ resolveListing: (...args: unknown[]) => mockResolveListing(...args) }));

const mockUseTenantListings = vi.fn();
vi.mock('@/hooks/useTenantListings', () => ({ useTenantListings: () => mockUseTenantListings() }));

const LIST_ROW = {
  id: 450,
  listingId: 450,
  propertyName: 'Bunk House',
  property_name: 'Bunk House',
  property_location: 'Goa',
  property_img: ['https://cdn.example.com/b1.jpg'],
  property_amenities: [],
  property_description: 'Hostel',
  property_price: 799,
  property_rating: 4.8,
  property_reviews: 12,
  checkInTime: '14:00',
  checkOutTime: '11:00',
  status: 'Published',
};

const renderPage = () => (
  <MemoryRouter initialEntries={['/homes/bunk-house/450']}>
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
      </Routes>
    </Suspense>
  </MemoryRouter>
);

describe('Homepage_PropertyDetails - HSL-011 dorm facts reach the booking widget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearListingTenantCacheForTests();
    _setTenantContextForTests({
      slug: 'atlas', name: 'Atlas Homes', brandName: 'Atlas Homes', isMarketplaceRoot: true,
      bookingMode: 'ONLINE', paymentProvider: 'RAZORPAY', whatsappBookingPhone: '9502244053',
    });
    mockUseTenantListings.mockReturnValue({ listings: [], properties: [LIST_ROW], state: 'success', refetch: vi.fn() });
    mockResolveListing.mockResolvedValue({ id: 450, propertyId: 97, name: '6-Bed Female-Only Dorm', propertyName: 'Bunk House' });
  });

  it('passes accommodationType, dormGenderPolicy and the bed count from the listing payload', async () => {
    mockFetchListingById.mockResolvedValue({
      id: 450, propertyName: 'Bunk House', name: '6-Bed Female-Only Dorm',
      accommodationType: 'HostelDorm', dormGenderPolicy: 'MaleOnly', quantity: 6,
    });
    render(renderPage());
    await settle();
    expect(mockUnitBookingWidget).toHaveBeenCalledWith(
      expect.objectContaining({ accommodationType: 'HostelDorm', dormGenderPolicy: 'MaleOnly', dormBedCount: 6 }),
    );
  });

  it('a dorm-looking NAME with no API dorm fields hands over nulls (no name guessing)', async () => {
    mockFetchListingById.mockResolvedValue({ id: 450, propertyName: 'Bunk House', name: '6-Bed Female-Only Dorm' });
    render(renderPage());
    await settle();
    expect(mockUnitBookingWidget).toHaveBeenCalledWith(
      expect.objectContaining({ accommodationType: null, dormGenderPolicy: null, dormBedCount: null }),
    );
    expect(mockUnitBookingWidget).not.toHaveBeenCalledWith(expect.objectContaining({ dormGenderPolicy: 'FemaleOnly' }));
  });
});
