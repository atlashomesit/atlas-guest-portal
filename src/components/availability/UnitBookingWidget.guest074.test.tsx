import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays } from 'date-fns';
import { toISODate } from '@/utils/dateRange';
import { getIstStartOfDay } from '@/utils/date';
import { clearAgentCode } from '@/lib/agentCode';
import { settle } from '../../test/settle';

const mocks = vi.hoisted(() => ({
  fetchCalendarPricing: vi.fn(),
  fetchGuestGstBreakdown: vi.fn(),
  fetchGuestPriceBreakdown: vi.fn(),
  booking: { checkIn: null as string | null, checkOut: null as string | null, guests: 2 },
}));

vi.mock('@/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasRuntimeConfig: () => true,
}));
vi.mock('@/tenant/tenantContext', () => ({
  getTenantContext: () => ({ slug: 'atlas', name: 'Atlastays', paymentProvider: 'RAZORPAY', bookingMode: 'ONLINE' }),
}));
vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `http://localhost:5120${path}`,
  getApiHeaders: () => ({}),
  getOrderRequestHeaders: () => ({}),
}));
vi.mock('@/api/availabilityCalendarClient', () => ({
  dedupedAvailabilityCalendarFetch: async () =>
    new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }),
}));
// The REAL fetchPublicListingRatePlans runs (it reads the remembered code); everything else the widget fetches is mocked.
vi.mock('@/api/pricingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchCalendarPricing: mocks.fetchCalendarPricing,
  fetchGuestGstBreakdown: mocks.fetchGuestGstBreakdown,
  fetchGuestPriceBreakdown: mocks.fetchGuestPriceBreakdown,
}));
vi.mock('@/api/listingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchPublicListings: async () => [],
}));
vi.mock('@/contexts/BookingContext', () => ({
  useBooking: () => ({ booking: mocks.booking, updateBooking: vi.fn() }),
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


import { fireEvent } from '@testing-library/react';
import { format } from 'date-fns';

/**
 * GUEST-074 through the real widget and the real calendar: on a home with a 3-night minimum the hint under the
 * dates names that minimum (it said "minimum one night"), and a day inside the minimum window is refused in words
 * that name the check-in, not left to look like nothing happened.
 */
beforeEach(() => {
  vi.clearAllMocks();
  clearAgentCode();
  mocks.booking.guests = 2;
  mocks.booking.checkIn = null;
  mocks.booking.checkOut = null;
  mocks.fetchCalendarPricing.mockResolvedValue({ dateToPrice: new Map<string, number>(), convenienceFeePercent: 0 });
  mocks.fetchGuestGstBreakdown.mockResolvedValue(null);
  mocks.fetchGuestPriceBreakdown.mockResolvedValue(null);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearAgentCode();
});

async function renderAndPickCheckIn(minStayNights: number) {
  const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
  await act(async () => {
    render(
      <MemoryRouter>
        <UnitBookingWidget listingId={7} propertyId={3} listingName="Villa" propertySlug="villa" unitSlug="u1" minStayNights={minStayNights} />
      </MemoryRouter>,
    );
  });
  await settle();
  const checkIn = addDays(getIstStartOfDay(new Date()), 10);
  await act(async () => {
    window.dispatchEvent(new CustomEvent('atlas:set-checkin', { detail: toISODate(checkIn) }));
  });
  await settle();
  return checkIn;
}

describe('UnitBookingWidget - GUEST-074: the minimum stay is named where the guest picks the check-out', () => {
  it('names a 3-night minimum in the hint under the dates', async () => {
    await renderAndPickCheckIn(3);
    expect(screen.getByTestId('guest-booking-incomplete-dates')).toHaveTextContent('minimum 3 nights after check-in');
  });

  it('keeps the one-night wording on a home with no minimum', async () => {
    await renderAndPickCheckIn(1);
    expect(screen.getByTestId('guest-booking-incomplete-dates')).toHaveTextContent('minimum one night after check-in');
  });

  it('a day inside the minimum window is refused in words, inside the date sheet too (the check-in stays, nothing restarts)', async () => {
    const checkIn = await renderAndPickCheckIn(3);
    fireEvent.click(document.getElementById('unit-booking-dates') as HTMLElement);
    await settle();
    const inside = addDays(checkIn, 1);
    const cell = screen.getAllByRole('gridcell').find((c) => (c.getAttribute('aria-label') ?? '').startsWith(format(inside, 'd MMMM')));
    expect(cell).toBeTruthy();
    fireEvent.click(cell as HTMLElement);
    await settle();
    const msg = screen.getByTestId('guest-booking-date-error');
    expect(msg).toHaveTextContent('Minimum stay is 3 nights');
    expect(screen.getByTestId('guest-booking-incomplete-dates')).toBeInTheDocument();
    // The sheet says it itself: on a phone it covers the message under the dates.
    expect(screen.getByTestId('booking-calendar-notice')).toHaveTextContent('Minimum stay is 3 nights');
  });
});
