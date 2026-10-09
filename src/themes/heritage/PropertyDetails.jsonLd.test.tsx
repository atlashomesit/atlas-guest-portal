import { render } from '@testing-library/react';
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
  resolveListing: (...args: unknown[]) => mockResolveListing(...args),
  resolveEffectiveListingAddress: (source: unknown) => source,
  normalizeListingPayload: vi.fn((raw) => raw),
}));

const mockUseTenantListings = vi.fn();
vi.mock('@/hooks/useTenantListings', () => ({
  useTenantListings: () => mockUseTenantListings(),
}));

const readJsonLd = (): Record<string, unknown>[] => {
  const script = document.head.querySelector('script[data-seo-json-ld]');
  expect(script?.textContent).toBeTruthy();
  return JSON.parse(script!.textContent!);
};

describe('Heritage PropertyDetails listing JSON-LD (REV-013)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetTenantContextForTests();
    document.head.querySelector('script[data-seo-json-ld]')?.remove();
    mockUseTenantListings.mockReturnValue({
      listings: [],
      properties: [
        {
          id: 505,
          listingId: 505,
          property_name: 'Heritage Villa',
          property_location: 'Goa',
          property_img: ['https://cdn.example.com/hvilla.jpg'],
          property_amenities: [],
          property_description: 'Luxurious villa in Goa',
          property_rating: 4.9,
          property_reviews: 0,
          property_price: 6000,
        },
      ],
      state: 'success',
      refetch: vi.fn(),
    });
  });

  it('includes external reviews and blended rating in aggregateRating and review nodes', async () => {
    mockResolveListing.mockResolvedValue({ id: 505, propertyId: 505 });
    const originalFetch = global.fetch;
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/public/listings/505') || url.includes('/public/listings/505')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              externalReviews: [
                {
                  guestName: 'Rahul',
                  rating: 5,
                  body: 'Exceptional heritage architecture and pool!',
                  reviewDate: '2026-10-05',
                  source: 'Google',
                },
                {
                  guestName: 'Ananya',
                  rating: 4,
                  body: 'Beautiful ambience and prompt service.',
                  reviewDate: '2026-10-06',
                  source: 'Airbnb',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (url.includes('/api/listings/505/reviews') || url.includes('/listings/505/reviews')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              averageRating: 0,
              totalCount: 0,
              reviews: [],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    });

    try {
      render(
        <MemoryRouter initialEntries={['/homes/heritagevilla/505']}>
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              <Route path="/homes/:propertySlug/:unitSlug" element={<HeritagePropertyDetails />} />
            </Routes>
          </Suspense>
        </MemoryRouter>,
      );

      await settle();
      const nodes = readJsonLd();
      const lodging = nodes.find((n) => n['@type'] === 'LodgingBusiness') as Record<string, unknown>;
      expect(lodging).toBeDefined();

      const aggregateRating = lodging['aggregateRating'] as Record<string, unknown>;
      expect(aggregateRating).toBeDefined();
      expect(aggregateRating['@type']).toBe('AggregateRating');
      // (5 + 4) / 2 = 4.5
      expect(aggregateRating['ratingValue']).toBe(4.5);
      expect(aggregateRating['reviewCount']).toBe(2);

      const reviews = lodging['review'] as Record<string, unknown>[];
      expect(reviews).toBeDefined();
      expect(reviews).toHaveLength(2);
      expect(reviews.map((r) => (r['author'] as Record<string, unknown>)['name'])).toEqual(['Ananya', 'Rahul']);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
