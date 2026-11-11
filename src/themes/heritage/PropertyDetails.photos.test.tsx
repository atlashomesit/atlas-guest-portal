import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense } from 'react';
import HeritagePropertyDetails from './PropertyDetails';
import { settle } from '../../test/settle';
import { _resetTenantContextForTests } from '@/tenant/tenantContext';

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
  resolveListingFromRoute: (...args: unknown[]) => mockResolveListing(...args),
}));

const mockUseTenantListings = vi.fn();
vi.mock('@/hooks/useTenantListings', () => ({
  useTenantListings: () => mockUseTenantListings(),
}));

describe('Heritage PropertyDetails review photos (REV-017)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetTenantContextForTests();
    mockUseTenantListings.mockReturnValue({
      listings: [],
      properties: [
        {
          id: 601,
          listingId: 601,
          property_name: 'Sunset Villa',
          property_location: 'Udaipur',
          property_img: ['https://cdn.example.com/sunset.jpg'],
          property_amenities: [],
          property_description: 'Royal villa in Udaipur',
          property_rating: 5.0,
          property_reviews: 1,
          property_price: 12000,
        },
      ],
      state: 'success',
      refetch: vi.fn(),
    });
  });

  it('renders guest review photo thumbnails and opens lightbox on click', async () => {
    mockResolveListing.mockResolvedValue({ id: 601, propertyId: 601 });
    const originalFetch = global.fetch;
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/public/listings/601') || url.includes('/public/listings/601')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ externalReviews: [] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (url.includes('/api/listings/601/reviews') || url.includes('/listings/601/reviews')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              averageRating: 5,
              totalCount: 1,
              reviews: [
                {
                  id: 701,
                  guestName: 'Karan Mehra',
                  rating: 5,
                  title: 'Outstanding stay',
                  body: 'Loved the infinity pool!',
                  createdAt: '2026-10-08T12:00:00Z',
                  photoUrls: [
                    'https://blob.example.com/guest-photo-1.jpg',
                    'https://blob.example.com/guest-photo-2.jpg',
                  ],
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (url.includes('/reviews/summary')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    try {
      render(
        <MemoryRouter initialEntries={['/property/601']}>
          <Suspense fallback={<div>Loading</div>}>
            <Routes>
              <Route path="/property/:id" element={<HeritagePropertyDetails />} />
            </Routes>
          </Suspense>
        </MemoryRouter>,
      );

      await settle();

      const photosContainer = screen.getByTestId('review-photos');
      expect(photosContainer).toBeInTheDocument();

      const thumb0 = screen.getByTestId('review-photo-thumb-0');
      const thumb1 = screen.getByTestId('review-photo-thumb-1');
      expect(thumb0.querySelector('img')).toHaveAttribute('src', 'https://blob.example.com/guest-photo-1.jpg');
      expect(thumb1.querySelector('img')).toHaveAttribute('src', 'https://blob.example.com/guest-photo-2.jpg');

      // Click photo to open lightbox
      fireEvent.click(thumb0);
      await settle();

      // Lightbox modal renders with image
      const lightboxImg = screen.getByAltText('Photo 1');
      expect(lightboxImg).toHaveAttribute('src', 'https://blob.example.com/guest-photo-1.jpg');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
