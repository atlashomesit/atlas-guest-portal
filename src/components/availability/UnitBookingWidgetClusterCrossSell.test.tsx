/**
 * CLU-011 - the Whole-Villa cross-sell banner is reachable from the REAL booking widget:
 *   - role comes from the API payload (clusterRole + clusterId), never from the listing name;
 *   - some Children booked  -> "The whole villa is taken because N rooms are booked, but M are free" + cards;
 *   - Parent itself booked  -> no claim about rooms;
 *   - no free Child         -> no banner;
 *   - a "Whole Villa"-named listing without an API role gets no banner (the old name regex is gone).
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

type Props = { clusterRole?: string | null; clusterId?: number | null; listingName?: string };

let checkInIso = '';
let checkOutIso = '';

async function renderWidget(props: Props) {
  const checkIn = getIstStartOfDay(nextFriday(addDays(new Date(), 7)));
  const checkOut = addDays(checkIn, 2);
  checkInIso = toISODate(checkIn);
  checkOutIso = toISODate(checkOut);
  mocks.booking.checkIn = checkInIso;
  mocks.booking.checkOut = checkOutIso;
  mocks.calendarDates = [checkInIso];
  mocks.fetchCalendarPricing.mockResolvedValue({ dateToPrice: new Map(), convenienceFeePercent: 3 });
  mocks.fetchGuestPriceBreakdown.mockResolvedValue(null);
  mocks.fetchAvailabilityRatesForMonths.mockResolvedValue([]);

  const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
  await act(async () => {
    render(
      <MemoryRouter>
        <UnitBookingWidget
          listingId={7}
          propertyId={3}
          listingName={props.listingName ?? 'Grand 6-BHK Heritage Villa (Entire Estate)'}
          propertySlug="villa"
          unitSlug="grand"
          maxGuests={12}
          clusterRole={props.clusterRole}
          clusterId={props.clusterId}
        />
      </MemoryRouter>,
    );
  });
  await settle();
  await settle();
}

const free = (id: number, name: string, nightlyRate: number) => ({
  listingId: id, name, nightlyRate, currency: 'INR', coverPhotoUrl: null,
});

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  mocks.booking.checkIn = null;
  mocks.booking.checkOut = null;
});

describe('UnitBookingWidget - CLU-011 whole-villa cross-sell', () => {
  it('Parent from the API payload + some Children booked: real cause, free rooms, prefilled links', async () => {
    mocks.fetchClusterChildrenAvailability.mockResolvedValue({
      cause: 'ChildrenBooked', totalChildren: 6, unavailableChildren: 1,
      freeChildren: [free(102, 'Suite 102', 4500), free(103, 'Suite 103', 5200)],
    });
    await renderWidget({ clusterRole: 'PARENT', clusterId: 9 });

    expect(mocks.fetchClusterChildrenAvailability).toHaveBeenCalledWith(7, checkInIso, checkOutIso, null, expect.any(AbortSignal));
    expect(screen.getByTestId('cluster-cross-sell-headline')).toHaveTextContent(
      'The whole villa is taken because 1 room is booked, but 2 are free.',
    );
    expect(screen.getByTestId('cluster-cross-sell-count')).toHaveTextContent('2 of 6 rooms are free on these dates');
    expect(screen.getByTestId('child-room-card-102')).toHaveTextContent('₹4,500/night');
    expect(screen.getByTestId('select-child-room-102')).toHaveAttribute(
      'href',
      `/homes/villa/102?checkIn=${checkInIso}&checkOut=${checkOutIso}`,
    );
  });

  it('Parent itself booked/blocked: no cross-sell claim about rooms', async () => {
    mocks.fetchClusterChildrenAvailability.mockResolvedValue({
      cause: 'ParentUnavailable', totalChildren: 6, unavailableChildren: 0, freeChildren: [],
    });
    await renderWidget({ clusterRole: 'PARENT', clusterId: 9 });
    expect(mocks.fetchClusterChildrenAvailability).toHaveBeenCalled();
    expect(screen.queryByTestId('cluster-parent-child-cross-sell')).toBeNull();
  });

  it('no free Child: no banner', async () => {
    mocks.fetchClusterChildrenAvailability.mockResolvedValue({
      cause: 'ChildrenBooked', totalChildren: 6, unavailableChildren: 6, freeChildren: [],
    });
    await renderWidget({ clusterRole: 'PARENT', clusterId: 9 });
    expect(screen.queryByTestId('cluster-parent-child-cross-sell')).toBeNull();
  });

  it('control: the name regex is gone - a "Whole Villa" listing with no API role asks nothing and shows no banner', async () => {
    mocks.fetchClusterChildrenAvailability.mockResolvedValue({
      cause: 'ChildrenBooked', totalChildren: 6, unavailableChildren: 1, freeChildren: [free(102, 'Suite 102', 4500)],
    });
    await renderWidget({ listingName: 'Whole Villa Estate', clusterRole: null, clusterId: null });
    expect(mocks.fetchClusterChildrenAvailability).not.toHaveBeenCalled();
    expect(screen.queryByTestId('cluster-parent-child-cross-sell')).toBeNull();
  });

  it('control: a CHILD listing never asks for children', async () => {
    await renderWidget({ clusterRole: 'CHILD', clusterId: 9 });
    expect(mocks.fetchClusterChildrenAvailability).not.toHaveBeenCalled();
  });
});
