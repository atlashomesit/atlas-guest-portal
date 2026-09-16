import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense } from 'react';
import Homepage_PropertyDetails from './Homepage_PropertyDetails';
import { resolveEffectiveListingAddress } from '../../../utils/listingAddress';

vi.mock('@/components/availability/UnitBookingWidget', () => ({
  __esModule: true,
  default: () => <div>Booking Widget</div>,
}));

vi.mock('@/components/AvailabilityCalendar', () => ({
  __esModule: true,
  default: () => <div>Availability Calendar</div>,
}));

vi.mock('@/components/GuestAssistant', () => ({
  __esModule: true,
  default: () => <div>Guest Assistant</div>,
}));

vi.mock('@/components/homepage_components/hotelBooking_form/BookingCard.tsx', () => ({
  __esModule: true,
  default: () => <div id="booking-form">Booking Form</div>,
}));

vi.mock('@/utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/utils/pricing', () => ({
  calculateNightlyPrice: vi.fn(() => ({ finalNightlyPrice: 1000 })),
  inferUnitType: vi.fn(() => 'test-unit'),
}));

vi.mock('@/config/policyConfig', () => ({
  getUnitPolicy: () => ({ checkIn: '2:00 PM', checkOut: '11:00 AM' }),
}));

vi.mock('@/content/terms', () => ({
  inlinePolicySnippets: { cancellation: 'Flexible cancellation', houseRules: 'Be kind' },
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

vi.mock('@fancyapps/ui', () => ({
  Fancybox: {
    bind: vi.fn(),
    destroy: vi.fn(),
    show: vi.fn(),
  },
}));

const mockResolveListing = vi.fn();
vi.mock('@/utils/listingResolver', () => ({
  resolveListing: (...args: unknown[]) => mockResolveListing(...args),
  resolveEffectiveListingAddress: (source: unknown) => resolveEffectiveListingAddress(source),
  normalizeListingPayload: vi.fn((raw) => raw),
}));

const mockUseTenantListings = vi.fn();
vi.mock('@/hooks/useTenantListings', () => ({
  useTenantListings: () => mockUseTenantListings(),
}));

describe('Homepage_PropertyDetails listing address resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Unit/Listing Address when filled in', async () => {
    mockUseTenantListings.mockReturnValue({
      listings: [],
      properties: [
        {
          id: 101,
          listingId: 101,
          property_name: 'Azure Villa',
          property_address: 'Suite 404, Sea Breeze Towers',
          propertyAddress: 'Suite 404, Sea Breeze Towers',
          property_location: 'Suite 404, Sea Breeze Towers',
          property_img: ['https://cdn.example.com/img1.jpg'],
          property_amenities: [],
          property_description: 'Villa with ocean view',
          property_rating: 4.9,
          property_reviews: 10,
          property_price: 2500,
        },
      ],
      state: 'success',
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/homes/azure-villa/101']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    );

    const addressEl = await screen.findByTestId('property-street-address');
    expect(addressEl).toHaveTextContent('Suite 404, Sea Breeze Towers');
  });

  it('falls back to property Location Address when Unit/Listing Address is empty or null', async () => {
    mockUseTenantListings.mockReturnValue({
      listings: [],
      properties: [
        {
          id: 102,
          listingId: 102,
          property_name: 'Azure Villa',
          property_address: '456 Coastline Boulevard, Miami, FL',
          propertyAddress: '456 Coastline Boulevard, Miami, FL',
          property_location: '456 Coastline Boulevard, Miami, FL',
          property_img: ['https://cdn.example.com/img1.jpg'],
          property_amenities: [],
          property_description: 'Villa with ocean view',
          property_rating: 4.8,
          property_reviews: 5,
          property_price: 2200,
        },
      ],
      state: 'success',
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/homes/azure-villa/102']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    );

    const addressEl = await screen.findByTestId('property-street-address');
    expect(addressEl).toHaveTextContent('456 Coastline Boulevard, Miami, FL');
  });

  it('dynamically resolves address from API fallback when unit address is populated', async () => {
    // Return empty properties from hook to trigger API fallback resolveListing
    mockUseTenantListings.mockReturnValue({
      listings: [],
      properties: [],
      state: 'success',
      refetch: vi.fn(),
    });

    mockResolveListing.mockResolvedValue({
      id: 201,
      propertyId: 10,
      name: 'Sky Penthouse',
      propertyName: 'Sky Tower',
      address: 'Penthouse Unit 900',
      propertyAddress: '100 Skyline Ave',
      propertyLocationAddress: '100 Skyline Ave',
      locationAddress: '100 Skyline Ave',
      property_location: '100 Skyline Ave',
      price: 3500,
      photoUrls: ['https://cdn.example.com/sky.jpg'],
      cancellationTier: 'flexible',
    });

    render(
      <MemoryRouter initialEntries={['/homes/sky-tower/201']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const addressEl = screen.getByTestId('property-street-address');
      expect(addressEl).toHaveTextContent('Penthouse Unit 900');
    });
  });

  it('dynamically resolves property Location Address from API fallback when unit address is blank', async () => {
    // Return empty properties from hook to trigger API fallback resolveListing
    mockUseTenantListings.mockReturnValue({
      listings: [],
      properties: [],
      state: 'success',
      refetch: vi.fn(),
    });

    mockResolveListing.mockResolvedValue({
      id: 202,
      propertyId: 10,
      name: 'Sky Studio',
      propertyName: 'Sky Tower',
      address: '   ', // whitespace / blank unit address
      propertyAddress: '100 Skyline Ave',
      propertyLocationAddress: '100 Skyline Ave',
      locationAddress: '100 Skyline Ave',
      property_location: '100 Skyline Ave',
      price: 1800,
      photoUrls: ['https://cdn.example.com/sky.jpg'],
      cancellationTier: 'flexible',
    });

    render(
      <MemoryRouter initialEntries={['/homes/sky-tower/202']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const addressEl = screen.getByTestId('property-street-address');
      expect(addressEl).toHaveTextContent('100 Skyline Ave');
    });
  });
});
