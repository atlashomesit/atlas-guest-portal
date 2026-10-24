import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Homepage_PropertyDetails from './Homepage_PropertyDetails';
import { settle } from '../../../test/settle';
import {
  _setListingTenantContextForTests,
  _clearListingTenantCacheForTests,
} from '@/tenant/tenantContext';

const mockUnitBookingWidget = vi.fn();
vi.mock('@/components/availability/UnitBookingWidget', () => ({
  __esModule: true,
  default: (props: any) => {
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
  Fancybox: { bind: vi.fn(), destroy: vi.fn(), show: vi.fn() },
}));

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
  });
});
