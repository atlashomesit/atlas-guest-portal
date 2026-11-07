import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HeritagePropertyDetails from '../heritage/PropertyDetails';
import ClassicPropertyDetails from '@/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails';
import { settle } from '../../test/settle';
import {
  _setListingTenantContextForTests,
  _clearListingTenantCacheForTests,
} from '@/tenant/tenantContext';
import { _resetTenantResolutionForTests } from '@/tenant/tenantResolver';

vi.mock('@/components/availability/UnitBookingWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-booking-widget">UnitBookingWidget</div>,
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
    booking: { propertyId: null, checkIn: null, checkOut: null, guests: 4 },
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

const dailyPricingState: { loading: boolean; rows: unknown[] } = { loading: true, rows: [] };
vi.mock('@/hooks/useDailyPricingSummary', () => ({
  useDailyPricingSummary: () => ({
    data: dailyPricingState.loading ? null : { date: '2026-11-07', listings: dailyPricingState.rows },
    loading: dailyPricingState.loading,
    error: null,
    getListingPricing: () => null,
  }),
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
  property_img: [] as string[],
  property_amenities: [],
  property_description: 'Cozy stay in Guwahati',
  property_price: 4000,
  property_rating: 4.8,
  property_reviews: 12,
  checkInTime: '14:00',
  checkOutTime: '11:00',
  status: 'Published',
};

describe.each([
  ['heritage', HeritagePropertyDetails],
  ['classic', ClassicPropertyDetails],
])('GUEST-064 %s listing page: loading state, not placeholders or interim prices', (_name, Page) => {
  let resolveDetail: (v: unknown) => void = () => {};
  beforeEach(() => {
    vi.clearAllMocks();
    _clearListingTenantCacheForTests();
    _resetTenantResolutionForTests();
    dailyPricingState.loading = true;
    dailyPricingState.rows = [];
    mockUseTenantListings.mockReturnValue({ listings: [], properties: [LIST_ROW], state: 'success', refetch: vi.fn() });
    mockResolveListing.mockReturnValue(LIST_ROW);
    mockFetchSimilarListings.mockResolvedValue([]);
    mockFetchListingById.mockImplementation(
      () => new Promise((resolve) => { resolveDetail = resolve; }),
    );
  });
  afterEach(() => {
    cleanup();
    _clearListingTenantCacheForTests();
    _resetTenantResolutionForTests();
  });

  const mount = () =>
    render(
      <MemoryRouter initialEntries={['/homes/comfort-cove/450?tenant=atlas']}>
        <Routes>
          <Route path="/homes/:propertySlug/:unitSlug" element={<Page />} />
        </Routes>
      </MemoryRouter>,
    );

  it('shows a gallery skeleton and no price until the photos and rates have loaded', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('gallery-skeleton')).toBeTruthy();
    expect(screen.getByTestId('mobile-sticky-price-skeleton')).toBeTruthy();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/Photos coming soon/i);
    expect(text).not.toMatch(/\d+ photos?\b/);
    // the interim estimate from the mocked calculateNightlyPrice (1,000) must never reach the guest
    expect(screen.getByTestId('mobile-sticky-price-skeleton').closest('div')?.textContent ?? '').not.toMatch(/1,000/);

    // rates arrive: the bar shows the SAME number the search card and booking box use (actualPrice)
    dailyPricingState.loading = false;
    dailyPricingState.rows = [{ listingId: 450, baseAmount: 3700, discountAmount: 158, finalAmount: 3751 }];
    await act(async () => {
      resolveDetail({ ...LIST_ROW, photoUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'] });
    });
    await settle();
    expect(screen.queryByTestId('gallery-skeleton')).toBeNull();
    expect(screen.queryByTestId('mobile-sticky-price-skeleton')).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(/Photos coming soon/i);
    expect(document.body.textContent ?? '').toMatch(/3,542/);
    expect(document.body.textContent ?? '').not.toMatch(/3,751/);
  });

  it('keeps the skeleton (not the lone cover photo) while the listing detail is pending', async () => {
    mockUseTenantListings.mockReturnValue({
      listings: [],
      properties: [{ ...LIST_ROW, property_img: ['https://cdn.example.com/cover.jpg'] }],
      state: 'success',
      refetch: vi.fn(),
    });
    mockResolveListing.mockReturnValue({ ...LIST_ROW, property_img: ['https://cdn.example.com/cover.jpg'] });
    mount();
    await settle();
    expect(screen.getByTestId('gallery-skeleton')).toBeTruthy();
    expect(document.querySelector('.pp-cell-hero img')).toBeNull();
    await act(async () => {
      resolveDetail({ ...LIST_ROW, photoUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'] });
    });
    await settle();
    expect(screen.queryByTestId('gallery-skeleton')).toBeNull();
    expect(document.querySelector('.pp-cell-hero img')).not.toBeNull();
  });

  it('shows "Photos coming soon" only once the listing has answered with no photos', async () => {
    mount();
    await settle();
    expect(screen.queryByText(/Photos coming soon/i)).toBeNull();
    await act(async () => {
      resolveDetail({ ...LIST_ROW, photoUrls: [] });
    });
    await settle();
    expect(screen.queryByTestId('gallery-skeleton')).toBeNull();
    expect(screen.getByText(/Photos coming soon/i)).toBeTruthy();
  });
});
