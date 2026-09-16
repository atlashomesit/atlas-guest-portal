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

let mockUseTenantListings = vi.fn();
vi.mock('@/hooks/useTenantListings', () => ({
  useTenantListings: () => mockUseTenantListings(),
}));

describe('TASK-102020: Property page check-in / check-out time rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders check-in and check-out times in Things to know when set in tenant listings', async () => {
    mockUseTenantListings.mockReturnValue({
      listings: [],
      properties: [
        {
          id: 637,
          listingId: 637,
          property_name: 'Azure Villa',
          property_address: 'Suite 404',
          propertyAddress: 'Suite 404',
          property_location: 'Goa',
          property_img: ['https://cdn.example.com/img1.jpg'],
          property_amenities: [],
          property_description: 'Villa with ocean view',
          property_rating: 4.9,
          property_reviews: 10,
          property_price: 2500,
          checkInTime: '14:00',
          checkOutTime: '11:00',
        },
      ],
      state: 'success',
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/homes/azure-villa/637']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    );

    await waitFor(() => {
      const checkInEls = screen.getAllByTestId('property-check-in-time');
      expect(checkInEls.length).toBeGreaterThan(0);
      expect(checkInEls[0].textContent).toContain('14:00');

      const checkOutEl = screen.getByTestId('property-check-out-time');
      expect(checkOutEl).toBeInTheDocument();
      expect(checkOutEl.textContent).toBe('11:00');
    });
  });

  it('renders check-in and check-out times when resolved via GET /listings/{id} API fallback', async () => {
    mockUseTenantListings.mockReturnValue({
      listings: [],
      properties: [],
      state: 'success',
      refetch: vi.fn(),
    });

    mockResolveListing.mockResolvedValue({
      id: 637,
      name: 'Azure Villa',
      propertyName: 'Azure Villa',
      coverPhotoUrl: 'https://cdn.example.com/img1.jpg',
      photoUrls: ['https://cdn.example.com/img1.jpg'],
      property_location: 'Goa',
      checkInTime: '14:00',
      checkOutTime: '11:00',
      maxGuests: 4,
      baseNightlyRate: 3500,
    });

    render(
      <MemoryRouter initialEntries={['/homes/azure-villa/637']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    );

    await waitFor(() => {
      const checkInEls = screen.getAllByTestId('property-check-in-time');
      expect(checkInEls.length).toBeGreaterThan(0);
      expect(checkInEls[0].textContent).toContain('14:00');

      const checkOutEl = screen.getByTestId('property-check-out-time');
      expect(checkOutEl).toBeInTheDocument();
      expect(checkOutEl.textContent).toBe('11:00');
    });
  });
});
