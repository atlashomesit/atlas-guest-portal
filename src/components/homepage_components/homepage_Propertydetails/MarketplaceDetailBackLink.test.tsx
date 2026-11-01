import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Homepage_PropertyDetails from './Homepage_PropertyDetails';
import { settle } from '../../../test/settle';
import {
  _setListingTenantContextForTests,
  _clearListingTenantCacheForTests,
} from '@/tenant/tenantContext';
import { _resetTenantResolutionForTests } from '@/tenant/tenantResolver';

let mockBookingGuests = 2;

const mockUnitBookingWidget = vi.fn();
vi.mock('@/components/availability/UnitBookingWidget', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockUnitBookingWidget(props);
    return <div data-testid="mock-booking-widget">UnitBookingWidget</div>;
  },
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
    booking: { propertyId: null, checkIn: null, checkOut: null, guests: mockBookingGuests },
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

const listState = (properties: unknown[]) => ({ listings: [], properties, state: 'success', refetch: vi.fn() });

const renderPage = (initialUrl: string) => (
  <MemoryRouter initialEntries={[initialUrl]}>
    <Routes>
      <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
    </Routes>
  </MemoryRouter>
);

describe('TASK-1039953 — Safe fallback back navigation on Marketplace Detail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearListingTenantCacheForTests();
    mockUseTenantListings.mockReturnValue(listState([LIST_ROW]));
    mockResolveListing.mockReturnValue(LIST_ROW);
    mockFetchListingById.mockResolvedValue(LIST_ROW);
    mockFetchSimilarListings.mockResolvedValue([]);
  });

  it('provides a fallback "Back to all listings" link to / when entering directly without search state', async () => {
    _setListingTenantContextForTests('atlas', {
      slug: 'atlas',
      name: 'Atlas Homes',
      brandName: 'Atlas Homes',
      bookingMode: 'ONLINE',
      paymentProvider: 'RAZORPAY',
      whatsappBookingPhone: '9502244053',
    });

    render(renderPage('/homes/comfort-cove/450?tenant=atlas'));
    await settle();

    const backLink = screen.getByTestId('back-to-results');
    expect(backLink).toBeInTheDocument();
    expect(backLink.getAttribute('href')).toBe('/');
    expect(backLink.textContent).toBe('Back to all listings');

    const backAll = screen.getByTestId('back-to-all-listings');
    expect(backAll.getAttribute('href')).toBe('/');

    const backBtn = screen.getByTestId('back-to-results-btn');
    expect(backBtn).toBeInTheDocument();
    expect(backBtn.getAttribute('href')).toBe('/');
  });

  it('links back to search results URL when search params are present', async () => {
    _setListingTenantContextForTests('atlas', {
      slug: 'atlas',
      name: 'Atlas Homes',
      brandName: 'Atlas Homes',
      bookingMode: 'ONLINE',
      paymentProvider: 'RAZORPAY',
      whatsappBookingPhone: '9502244053',
    });

    render(renderPage('/homes/comfort-cove/450?tenant=atlas&city=Goa&category=homes'));
    await settle();

    const backLink = screen.getByTestId('back-to-results');
    expect(backLink).toBeInTheDocument();
    expect(backLink.textContent).toBe('Search results');
    expect(backLink.getAttribute('href')).toContain('city=Goa');
    expect(backLink.getAttribute('href')).toContain('category=homes');

    const backBtn = screen.getByTestId('back-to-results-btn');
    expect(backBtn).toBeInTheDocument();
    expect(backBtn.getAttribute('href')).toContain('city=Goa');
    expect(backBtn.getAttribute('href')).toContain('category=homes');
  });

  afterEach(() => {
    cleanup();
    mockBookingGuests = 2;
    _clearListingTenantCacheForTests();
    _resetTenantResolutionForTests();
  });

  it('TASK-1040085: preserves ?brand=atlastays and utm_* params on Back to all listings / breadcrumbs even without search filters', async () => {
    _setListingTenantContextForTests('atlas', {
      slug: 'atlas',
      name: 'Atlas Homes',
      brandName: 'Atlas Homes',
      bookingMode: 'ONLINE',
      paymentProvider: 'RAZORPAY',
      whatsappBookingPhone: '9502244053',
    });

    const detailUrl = '/homes/comfort-cove/450?tenant=atlas&brand=atlastays&utm_source=ig&utm_campaign=diwali';
    render(renderPage(detailUrl));
    await settle();

    for (const testId of ['back-to-results', 'back-to-all-listings', 'back-to-results-btn']) {
      const link = screen.getByTestId(testId);
      const href = link.getAttribute('href') ?? '';
      expect(href).toContain('brand=atlastays');
      expect(href).toContain('utm_source=ig');
      expect(href).toContain('utm_campaign=diwali');
    }
  });

  it('GUEST-051: displays price per night, max guests, >=4★ rating, and prioritizes party-fitting similar stays', async () => {
    mockBookingGuests = 5;
    const siblingSmall = {
      id: 451,
      listingId: 451,
      propertyName: 'Cozy Studio',
      property_name: 'Cozy Studio',
      property_location: 'Guwahati, Assam',
      property_img: ['https://cdn.example.com/studio.jpg'],
      property_amenities: [],
      property_description: 'Studio',
      property_price: 2500,
      maxGuests: 2,
      property_rating: 3.6, // sub-4-star -> must be suppressed
      property_reviews: 4,
      status: 'Published',
    };
    const siblingLarge = {
      id: 452,
      listingId: 452,
      propertyName: 'Grand Family Villa',
      property_name: 'Grand Family Villa',
      property_location: 'Guwahati, Assam',
      property_img: ['https://cdn.example.com/villa.jpg'],
      property_amenities: [],
      property_description: 'Family villa',
      property_price: 6800,
      maxGuests: 6,
      property_rating: 4.9,
      property_reviews: 18,
      status: 'Published',
    };

    mockUseTenantListings.mockReturnValue(listState([LIST_ROW, siblingSmall, siblingLarge]));
    mockFetchSimilarListings.mockResolvedValue([siblingSmall, siblingLarge]);

    render(renderPage('/homes/comfort-cove/450?tenant=atlas&brand=atlastays&guests=5'));
    await settle();

    const cards = screen.getAllByTestId('similar-stay-price');
    expect(cards.length).toBe(2);
    // Party-fitting Grand Family Villa (maxGuests=6 >= 5) must be sorted FIRST ahead of Cozy Studio (maxGuests=2)
    expect(cards[0].textContent).toContain('from ₹6,800 / night');
    expect(cards[1].textContent).toContain('from ₹2,500 / night');

    const guestLabels = screen.getAllByTestId('similar-stay-guests');
    expect(guestLabels[0].textContent).toBe('Up to 6 guests');
    expect(guestLabels[1].textContent).toBe('Up to 2 guests');

    // Only the >= 4.0 rating renders; 3.6 is suppressed per founder rule
    const ratings = screen.getAllByTestId('similar-stay-rating');
    expect(ratings).toHaveLength(1);
    expect(ratings[0].textContent).toContain('4.9');
    expect(ratings[0].textContent).toContain('(18)');
  });
});
