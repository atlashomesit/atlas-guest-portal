/**
 * TASK-1040051: while GET /api/pricing/guest-breakdown answered 409 PRICING_NOT_CONFIGURED the booking box read
 * "Accommodation INR 0 / Total INR 1" with Reserve enabled. The refusal now speaks for the stay: the API's sentence, no amount.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, nextFriday } from 'date-fns';
import { toISODate } from '@/utils/dateRange';
import { getIstStartOfDay } from '@/utils/date';
import { PricingNotConfiguredError } from '@/utils/pricingNotConfigured';
import { settle } from '../../test/settle';

const mocks = vi.hoisted(() => ({
  fetchCalendarPricing: vi.fn(),
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

const SENTENCE = "This room can't be booked online yet. Please contact the host.";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  mocks.booking.checkIn = null;
  mocks.booking.checkOut = null;
});

describe('UnitBookingWidget - TASK-1040051: a stay the server refuses to price never shows an amount', () => {
  it('shows the API sentence, no INR figure and a disabled Reserve when guest-breakdown answers 409 PRICING_NOT_CONFIGURED', async () => {
    const stay = getIstStartOfDay(nextFriday(addDays(new Date(), 7)));
    const dateToPrice = new Map<string, number>();
    for (let i = 0; i < 4; i += 1) dateToPrice.set(toISODate(addDays(stay, i)), 0);
    mocks.fetchCalendarPricing.mockResolvedValue({ dateToPrice, convenienceFeePercent: 0 });
    mocks.fetchGuestPriceBreakdown.mockRejectedValue(new PricingNotConfiguredError(SENTENCE));

    mocks.booking.checkIn = toISODate(stay);
    mocks.booking.checkOut = toISODate(addDays(stay, 2));
    const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
    await act(async () => {
      render(
        <MemoryRouter>
          <UnitBookingWidget listingId={1515} propertyId={3} listingName="Room 1" propertySlug="qa-bot" unitSlug="room-1" />
        </MemoryRouter>,
      );
    });
    await settle();

    expect(screen.getByTestId('bw-pricing-not-configured')).toHaveTextContent(SENTENCE);
    expect(screen.getByTestId('bw-pricing-not-configured-headline')).toBeInTheDocument();
    expect(screen.queryByTestId('bw-per-night-price')).toBeNull();
    const form = screen.getByTestId('guest-booking-form');
    expect(form.textContent ?? '').not.toMatch(/₹\s?\d|INR\s?\d/);
    expect(form.getAttribute('data-can-review-booking')).toBe('false');
    const reserve = Array.from(form.querySelectorAll('button[type="submit"]')) as HTMLButtonElement[];
    expect(reserve.length).toBeGreaterThan(0);
    reserve.forEach((b) => expect(b).toBeDisabled());
  });
});
