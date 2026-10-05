import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Suspense } from 'react';
import Homepage_PropertyDetails from './Homepage_PropertyDetails';
import { settle } from '../../../test/settle';
import {
  _setListingTenantContextForTests,
  _clearListingTenantCacheForTests,
  _setTenantContextForTests,
} from '@/tenant/tenantContext';

const mockUnitBookingWidget = vi.fn();
vi.mock('@/components/availability/UnitBookingWidget', () => ({
  __esModule: true,
  default: (props: any) => {
    mockUnitBookingWidget(props);
    return (
      <div data-testid="mock-booking-widget">
        <span>UnitBookingWidget</span>
        {props.tenantContext?.bookingMode === 'WHATSAPP' ? (
          <span data-testid="widget-mode-whatsapp">WhatsApp Mode</span>
        ) : (
          <span data-testid="widget-mode-online">Online Mode</span>
        )}
      </div>
    );
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
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
      </Routes>
    </Suspense>
  </MemoryRouter>
);

describe('MKT-011: Marketplace detail page listing tenant context resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearListingTenantCacheForTests();

    // Default tenant on apex marketplace is atlas
    _setTenantContextForTests({
      slug: 'atlas',
      name: 'Atlas Homes',
      brandName: 'Atlas Homes',
      isMarketplaceRoot: true,
      bookingMode: 'ONLINE',
      paymentProvider: 'RAZORPAY',
      whatsappBookingPhone: '9502244053',
    });

    mockUseTenantListings.mockReturnValue(listState([LIST_ROW]));
    mockResolveListing.mockResolvedValue({
      id: 450,
      propertyId: 97,
      name: 'Comfort Cove',
      propertyName: 'Comfort Cove',
    });
    mockFetchListingById.mockResolvedValue({
      id: 450,
      propertyName: 'Comfort Cove',
      shortDescription: 'Cozy stay in Guwahati',
      longDescription: 'Cozy stay in Guwahati full description',
    });
  });

  it('resolves listing tenant context for a WHATSAPP tenant (?tenant=mitali-saikia)', async () => {
    _setListingTenantContextForTests('mitali-saikia', {
      slug: 'mitali-saikia',
      name: 'Mitali Saikia',
      brandName: 'Mitali Saikia',
      bookingMode: 'WHATSAPP',
      whatsappBookingPhone: '919435508028',
    });

    render(renderPage('/homes/comfort-cove/450?tenant=mitali-saikia'));
    await settle();

    // 1. Host display name uses tenantName (never the raw slug)
    expect(screen.getByText(/Listed by Mitali Saikia/i)).toBeInTheDocument();
    expect(screen.queryByText(/Listed by mitali-saikia/i)).not.toBeInTheDocument();

    // 2. Trust points: Host-confirmed booking, no Razorpay copy
    expect(screen.getByText('Host-confirmed booking')).toBeInTheDocument();
    expect(screen.queryByText('Instant book')).not.toBeInTheDocument();
    expect(screen.queryByText(/Secure payment via Razorpay/i)).not.toBeInTheDocument();
    expect(screen.getByText(/You pay the host directly — no middle-man fees/i)).toBeInTheDocument();

    // 3. WhatsApp buttons hand off to the listing tenant's whatsappBookingPhone (919435508028), NOT Atlas (9502244053)
    const chatBtns = screen.getAllByTestId('chat-with-host-btn');
    expect(chatBtns.length).toBeGreaterThan(0);
    chatBtns.forEach((btn) => {
      expect(btn.getAttribute('href')).toContain('wa.me/919435508028');
      expect(btn.getAttribute('href')).not.toContain('9502244053');
    });

    // 4. UnitBookingWidget received the listing tenant's context with bookingMode WHATSAPP
    expect(mockUnitBookingWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantContext: expect.objectContaining({
          slug: 'mitali-saikia',
          bookingMode: 'WHATSAPP',
        }),
      }),
    );
  });

  it('keeps atlas context when ?tenant=atlas on marketplace host', async () => {
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

    // 1. Host display name
    expect(screen.getByText(/Listed by Atlas Homes/i)).toBeInTheDocument();

    // 2. Trust points: Instant book and Razorpay copy present
    expect(screen.getByText('Instant book')).toBeInTheDocument();
    expect(screen.getByText(/Secure payment via Razorpay/i)).toBeInTheDocument();

    // 3. WhatsApp button uses Atlas phone (7032493290)
    const chatBtns = screen.getAllByTestId('chat-with-host-btn');
    expect(chatBtns.length).toBeGreaterThan(0);
    chatBtns.forEach((btn) => {
      expect(btn.getAttribute('href')).toContain('wa.me/917032493290');
    });

    // 4. UnitBookingWidget received online bookingMode
    expect(mockUnitBookingWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantContext: expect.objectContaining({
          slug: 'atlas',
          bookingMode: 'ONLINE',
        }),
      }),
    );
  });
});
