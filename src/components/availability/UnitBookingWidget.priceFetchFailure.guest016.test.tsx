/**
 * G3 journey 16 (price shown = price charged): when the quote for the stay cannot be fetched (network drop) the page used to fall back to
 * the calendar's per-night sum, which has no extra-guest charge. For 3 guests on a home that includes 2 and charges 500 a night more per
 * extra guest, it showed 6,060 and an enabled Reserve where checkout charges 7,070. It now shows no figure and no Reserve for such a stay.
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
  booking: { checkIn: null as string | null, checkOut: null as string | null, guests: 3 },
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
vi.mock('./AtlasBookingCalendar', () => ({ AtlasBookingCalendar: () => null }));


const SENTENCE = 'We couldn’t work out the price for these dates. Please pick them again or try again in a moment.';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  mocks.booking.checkIn = null;
  mocks.booking.checkOut = null;
  mocks.booking.guests = 3;
});

async function renderStay(props: Record<string, unknown>, guests = 3) {
  const stay = getIstStartOfDay(nextFriday(addDays(new Date(), 7)));
  const dateToPrice = new Map<string, number>();
  for (let i = 0; i < 4; i += 1) dateToPrice.set(toISODate(addDays(stay, i)), 3000);
  mocks.fetchCalendarPricing.mockResolvedValue({ dateToPrice, convenienceFeePercent: 1 });
  mocks.fetchGuestPriceBreakdown.mockRejectedValue(new TypeError('Failed to fetch'));
  mocks.booking.checkIn = toISODate(stay);
  mocks.booking.checkOut = toISODate(addDays(stay, 2));
  mocks.booking.guests = guests;
  const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
  await act(async () => {
    render(
      <MemoryRouter>
        <UnitBookingWidget listingId={1515} propertyId={3} listingName="Room 1" propertySlug="qa-bot" unitSlug="room-1" maxGuests={4} {...props} />
      </MemoryRouter>,
    );
  });
  await settle();
  return screen.getByTestId('guest-booking-form');
}

describe('UnitBookingWidget - G3 journey 16: no under-quote when the quote cannot be fetched', () => {
  it('3 guests above 2 included at 500 each: no total, the plain sentence and no Reserve', async () => {
    const form = await renderStay({ includedGuests: 2, extraGuestRate: 500 });
    expect(screen.getByTestId('bw-pricing-not-configured')).toHaveTextContent(SENTENCE);
    expect(form.getAttribute('data-can-review-booking')).toBe('false');
    (Array.from(form.querySelectorAll('button[type="submit"]')) as HTMLButtonElement[]).forEach((b) => expect(b).toBeDisabled());
  });

  it('2 guests (within the included count): the fallback stays, Reserve is not blocked by this rule', async () => {
    await renderStay({ includedGuests: 2, extraGuestRate: 500 }, 2);
    expect(screen.queryByTestId('bw-pricing-not-configured')).toBeNull();
  });

  it('a home with no guest-count pricing keeps the fallback at 3 guests', async () => {
    await renderStay({}, 3);
    expect(screen.queryByTestId('bw-pricing-not-configured')).toBeNull();
  });
});
