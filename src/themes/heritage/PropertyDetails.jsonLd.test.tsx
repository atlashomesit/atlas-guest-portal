import { render, screen, within } from '@testing-library/react';
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

  it('REV-046: shows review-QR "Guest feedback" cards after the reviews and never counts them or puts them in the JSON-LD', async () => {
    mockResolveListing.mockResolvedValue({ id: 505, propertyId: 505 });
    const originalFetch = global.fetch;
    const feedback = [
      { guestName: 'Priya Nair', rating: 5, comment: 'Garden breakfast was lovely', date: '2026-10-27', label: 'Guest feedback' },
      { guestName: 'Dev', rating: 4, comment: 'Quiet and clean', date: '2026-10-20', label: 'Guest feedback' },
    ];
    const json = (body: unknown) =>
      Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/public/listings/505') || url.includes('/public/listings/505')) {
        return json({
          externalReviews: [
            { guestName: 'Rahul', rating: 5, body: 'Exceptional heritage architecture and pool!', reviewDate: '2026-10-05', source: 'Google' },
          ],
          guestFeedback: feedback,
        });
      }
      if (url.includes('/api/listings/505/reviews') || url.includes('/listings/505/reviews')) {
        return json({ averageRating: 0, totalCount: 0, reviews: [], guestFeedback: feedback });
      }
      return json({});
    }) as unknown as typeof fetch;

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
      await settle();

      // One real review: the header and the section heading say so, and the notes are not in them.
      expect(screen.getByTestId('property-header-rating')).toHaveTextContent('(1 review)');
      const reviewsSection = screen.getByTestId('reviews-section');
      expect(within(reviewsSection).getByRole('heading', { level: 2 })).toHaveTextContent('★ 5.0 from 1 guest');
      expect(within(screen.getByTestId('reviews-grid')).getAllByRole('article')).toHaveLength(1);
      expect(reviewsSection).not.toHaveTextContent('Garden breakfast was lovely');

      const feedbackSection = screen.getByTestId('guest-feedback-section');
      expect(reviewsSection.compareDocumentPosition(feedbackSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const cards = within(feedbackSection).getAllByTestId('guest-feedback-card');
      expect(cards).toHaveLength(2);
      for (const card of cards) {
        expect(within(card).getByTestId('guest-feedback-label')).toHaveTextContent('Guest feedback');
        expect(card).not.toHaveTextContent(/verified/i);
      }
      expect(within(cards[0]).getByText('Priya')).toBeInTheDocument();

      const nodes = readJsonLd();
      const lodging = nodes.find((n) => n['@type'] === 'LodgingBusiness') as Record<string, unknown>;
      const aggregateRating = lodging['aggregateRating'] as Record<string, unknown>;
      expect(aggregateRating['reviewCount']).toBe(1);
      expect(lodging['review'] as unknown[]).toHaveLength(1);
      const ld = JSON.stringify(nodes);
      for (const text of ['Priya', 'Dev', 'Garden breakfast', 'Quiet and clean', 'Guest feedback']) {
        expect(ld).not.toContain(text);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('REV-041: shows the real author name and a language chip on external review cards, as plain text', async () => {
    mockResolveListing.mockResolvedValue({ id: 505, propertyId: 505 });
    const originalFetch = global.fetch;
    const json = (body: unknown) =>
      Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/public/listings/505')) {
        return json({
          externalReviews: [
            { guestName: 'Guest', authorName: 'Amelie Dubois', locale: 'fr-FR', rating: 5, body: 'Superbe séjour, hôtes adorables.', reviewDate: '2026-10-03', source: 'Airbnb' },
            { guestName: 'Rahul', rating: 5, body: 'Peaceful stay with great views.', reviewDate: '2026-10-02', source: 'Airbnb' },
            { guestName: 'Mallory', locale: '<img src=x onerror=alert(1)>', rating: 5, body: 'Hostile locale string must not render.', reviewDate: '2026-10-01', source: 'Airbnb' },
          ],
        });
      }
      if (url.includes('/listings/505/reviews')) return json({ averageRating: 0, totalCount: 0, reviews: [] });
      return json({});
    }) as unknown as typeof fetch;

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
      await settle();

      const grid = screen.getByTestId('reviews-grid');
      const cards = within(grid).getAllByRole('article');
      expect(cards).toHaveLength(3);

      const amelie = cards.find((c) => c.textContent?.includes('Superbe'))!;
      expect(within(amelie).getByText('Amelie Dubois')).toBeInTheDocument();
      expect(within(amelie).getByTestId('review-locale-chip')).toHaveTextContent('French (France)');

      const rahul = cards.find((c) => c.textContent?.includes('Peaceful'))!;
      expect(within(rahul).queryByTestId('review-locale-chip')).not.toBeInTheDocument();

      const mallory = cards.find((c) => c.textContent?.includes('Hostile'))!;
      expect(within(mallory).queryByTestId('review-locale-chip')).not.toBeInTheDocument();
      expect(grid.querySelector('img[src="x"]')).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
