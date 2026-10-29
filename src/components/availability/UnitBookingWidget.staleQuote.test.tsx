/**
 * GUEST-048 (phone walk-through 27 Oct): after a date change the booking box kept the PREVIOUS dates' price for a few seconds ("₹5,451") before showing the new one ("₹5,936").
 *
 * Cause: `serverGstMatchesSelection` compared the selected range with itself (always true), so the server quote fetched for the old dates was used as the quote for the new dates until the
 * new fetch landed. The quote now carries the stay (dates | rate plan | guests) it was fetched for, and while the new stay's quote has not answered the headline holds the loading skeleton.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, nextFriday } from 'date-fns';
import { toISODate } from '@/utils/dateRange';
import { getIstStartOfDay } from '@/utils/date';
import type { GuestPriceBreakdown } from '@/api/pricingClient';
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

const money = (text: string | null | undefined): number => Number((text ?? '').replace(/[^0-9]/g, ''));

const quote = (finalAmount: number): GuestPriceBreakdown => ({
  baseAmount: finalAmount,
  discountAmount: 0,
  losDiscountAmount: 0,
  lastMinuteDiscountAmount: 0,
  repeatGuestDiscountAmount: 0,
  longStayDiscountAmount: 0,
  convenienceFeeAmount: 0,
  touristTaxAmount: 0,
  gstPercent: 0,
  gstAmount: 0,
  finalAmount,
  convenienceFeePercent: 0,
}) as GuestPriceBreakdown;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  mocks.booking.checkIn = null;
  mocks.booking.checkOut = null;
});

describe('UnitBookingWidget - GUEST-048: a date change never shows the previous dates\' price', () => {
  it('holds the loading skeleton until the new dates\' quote answers, then shows that quote', async () => {
    const stayA = getIstStartOfDay(nextFriday(addDays(new Date(), 7)));
    const stayB = addDays(stayA, 10);
    const isoA = toISODate(stayA);
    const isoB = toISODate(stayB);

    const dateToPrice = new Map<string, number>();
    for (let i = 0; i < 14; i += 1) {
      dateToPrice.set(toISODate(addDays(stayA, i)), 2500);
      dateToPrice.set(toISODate(addDays(stayB, i)), 2500);
    }
    mocks.fetchCalendarPricing.mockResolvedValue({ dateToPrice, convenienceFeePercent: 0 });

    let answerB: (value: GuestPriceBreakdown) => void = () => undefined;
    mocks.fetchGuestPriceBreakdown.mockImplementation((_listingId: unknown, start: string) =>
      start === isoA
        ? Promise.resolve(quote(5451))
        : new Promise<GuestPriceBreakdown>((resolve) => { answerB = resolve; }));

    mocks.booking.checkIn = isoA;
    mocks.booking.checkOut = toISODate(addDays(stayA, 2));
    const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
    // A fresh element each time: re-rendering the same element object would be skipped by React.
    const element = () => (
      <MemoryRouter>
        <UnitBookingWidget listingId={7} propertyId={3} listingName="Atlas 302" propertySlug="atlas302" unitSlug="u302" />
      </MemoryRouter>
    );
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(element()); });
    await settle();

    expect(money(screen.getByTestId('bw-per-night-price').textContent)).toBe(5451);

    // The guest picks other dates; the quote for them is still in flight.
    mocks.booking.checkIn = isoB;
    mocks.booking.checkOut = toISODate(addDays(stayB, 2));
    await act(async () => { view.rerender(element()); });
    await settle();

    expect(screen.getByTestId('bw-price-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('bw-per-night-price')).toBeNull();
    expect(document.body.textContent).not.toContain('5,451');

    // The new quote answers.
    await act(async () => { answerB(quote(5936)); });
    await settle();

    expect(screen.queryByTestId('bw-price-pending')).toBeNull();
    expect(money(screen.getByTestId('bw-per-night-price').textContent)).toBe(5936);
  });
});
