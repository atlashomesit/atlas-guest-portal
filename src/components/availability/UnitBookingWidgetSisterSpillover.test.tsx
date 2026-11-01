/**
 * CHN-012 (guest half) - the sister-property cards are reachable from the REAL booking widget:
 *   - the nights are genuinely taken -> the widget asks the API (property, dates, guest count) and shows the cards;
 *   - the API fails or returns nothing -> no cards, no claim;
 *   - the nights are free, or the property id is unknown -> the API is never asked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, nextFriday } from 'date-fns';
import { toISODate } from '@/utils/dateRange';
import { getIstStartOfDay } from '@/utils/date';
import { settle } from '../../test/settle';

const mocks = vi.hoisted(() => ({
  fetchCalendarPricing: vi.fn(),
  fetchGuestPriceBreakdown: vi.fn(),
  fetchAvailabilityRatesForMonths: vi.fn(),
  fetchClusterChildrenAvailability: vi.fn(),
  fetchSisterAvailability: vi.fn(),
  updateBooking: vi.fn(),
  booking: { checkIn: null as string | null, checkOut: null as string | null, guests: 2 },
  calendarDates: [] as string[],
  tenant: { slug: 'atlas', name: 'Atlastays', paymentProvider: 'RAZORPAY', bookingMode: 'ONLINE' },
}));

vi.mock('@/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasRuntimeConfig: () => true,
}));
vi.mock('@/tenant/tenantContext', () => ({ getTenantContext: () => ({ ...mocks.tenant }) }));
vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `http://localhost:5120${path}`,
  getApiHeaders: () => ({}),
  getOrderRequestHeaders: () => ({}),
}));
vi.mock('@/api/availabilityCalendarClient', () => ({
  dedupedAvailabilityCalendarFetch: async () =>
    new Response(
      JSON.stringify(mocks.calendarDates.map((date) => ({ date: `${date}T00:00:00Z`, status: 'booked' }))),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
}));
vi.mock('@/api/clusterChildrenClient', () => ({
  fetchClusterChildrenAvailability: mocks.fetchClusterChildrenAvailability,
}));
vi.mock('@/api/sisterAvailabilityClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchSisterAvailability: mocks.fetchSisterAvailability,
}));
vi.mock('@/api/availabilityRatesClient', () => ({
  fetchAvailabilityRatesForMonths: mocks.fetchAvailabilityRatesForMonths,
}));
vi.mock('@/api/pricingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchCalendarPricing: mocks.fetchCalendarPricing,
  fetchGuestPriceBreakdown: mocks.fetchGuestPriceBreakdown,
}));
vi.mock('@/api/listingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchPublicListings: async () => [],
}));
vi.mock('@/contexts/BookingContext', () => ({
  useBooking: () => ({ booking: mocks.booking, updateBooking: mocks.updateBooking }),
}));
vi.mock('@/contexts/ListingPhotosContext', () => ({
  useListingPhotosFromApi: () => ({ getUrlsForListingId: () => undefined }),
}));
vi.mock('@/hooks/useDailyPricingSummary', () => ({
  useDailyPricingSummary: () => ({
    data: null,
    loading: false,
    error: null,
    getListingPricing: () => ({ baseAmount: 6000, actualPrice: 6000, globalDiscountPercent: 0 }),
  }),
}));
vi.mock('@/components/FomoBar', () => ({ default: () => null }));
vi.mock('@/lib/events', () => ({ track: vi.fn() }));
vi.mock('./AtlasBookingCalendar', () => ({ AtlasBookingCalendar: () => null }));

let checkInIso = '';
let checkOutIso = '';

async function renderWidget({ datesTaken = true, propertyId = 3 as number | null } = {}) {
  const checkIn = getIstStartOfDay(nextFriday(addDays(new Date(), 7)));
  const checkOut = addDays(checkIn, 2);
  checkInIso = toISODate(checkIn);
  checkOutIso = toISODate(checkOut);
  mocks.booking.checkIn = checkInIso;
  mocks.booking.checkOut = checkOutIso;
  mocks.calendarDates = datesTaken ? [checkInIso] : [];
  mocks.fetchCalendarPricing.mockResolvedValue({ dateToPrice: new Map(), convenienceFeePercent: 3 });
  mocks.fetchGuestPriceBreakdown.mockResolvedValue(null);
  mocks.fetchAvailabilityRatesForMonths.mockResolvedValue([]);

  const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
  await act(async () => {
    render(
      <MemoryRouter>
        <UnitBookingWidget
          listingId={7}
          propertyId={propertyId ?? undefined}
          listingName="Madikeri Garden Room"
          propertySlug="atlas-homes-madikeri"
          unitSlug="7"
          maxGuests={4}
        />
      </MemoryRouter>,
    );
  });
  await settle();
  await settle();
}

const sisterAnswer = () => ({
  sourceSoldOut: true,
  checkIn: checkInIso,
  checkOut: checkOutIso,
  nights: 2,
  guests: 2,
  properties: [
    {
      propertyId: 8,
      propertyName: 'Atlas Homes Coorg',
      city: 'Madikeri',
      state: 'Karnataka',
      distanceKm: 12.4,
      listings: [
        { listingId: 81, listingName: 'Garden Suite', maxGuests: 3, coverPhotoUrl: null, currency: 'INR', totalAmount: 11800, averagePerNight: 5900 },
      ],
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  mocks.booking.checkIn = null;
  mocks.booking.checkOut = null;
});

describe('UnitBookingWidget - CHN-012 sister property spillover', () => {
  it('genuinely taken nights: asks the API for the property, dates and guests and shows the sister cards with a one-tap link', async () => {
    mocks.fetchSisterAvailability.mockImplementation(async () => sisterAnswer());
    await renderWidget();

    expect(mocks.fetchSisterAvailability).toHaveBeenCalledWith(3, checkInIso, checkOutIso, 2, null, expect.any(AbortSignal));
    expect(screen.getByTestId('sister-spillover-headline')).toHaveTextContent(
      'This property is full for your dates. Available at our sister property',
    );
    expect(screen.getByTestId('sister-offer-81')).toHaveTextContent('₹11,800');
    expect(screen.getByTestId('sister-offer-link-81')).toHaveAttribute(
      'href',
      `/homes/atlas-homes-coorg/81?checkIn=${checkInIso}&checkOut=${checkOutIso}&guests=2`,
    );
  });

  it('API failure (null): no cards', async () => {
    mocks.fetchSisterAvailability.mockResolvedValue(null);
    await renderWidget();
    expect(mocks.fetchSisterAvailability).toHaveBeenCalled();
    expect(screen.queryByTestId('sister-property-spillover')).toBeNull();
  });

  it('API says the property is not sold out, or has no card: nothing shown', async () => {
    mocks.fetchSisterAvailability.mockImplementation(async () => ({ ...sisterAnswer(), sourceSoldOut: false, properties: [] }));
    await renderWidget();
    expect(screen.queryByTestId('sister-property-spillover')).toBeNull();
  });

  it('free nights: the API is never asked', async () => {
    mocks.fetchSisterAvailability.mockImplementation(async () => sisterAnswer());
    await renderWidget({ datesTaken: false });
    expect(mocks.fetchSisterAvailability).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sister-property-spillover')).toBeNull();
  });

  it('no property id: the API is never asked', async () => {
    mocks.fetchSisterAvailability.mockImplementation(async () => sisterAnswer());
    await renderWidget({ propertyId: null });
    expect(mocks.fetchSisterAvailability).not.toHaveBeenCalled();
  });
});
