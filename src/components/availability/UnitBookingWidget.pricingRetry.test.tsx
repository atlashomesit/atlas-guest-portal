import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, addMonths, format, startOfMonth } from 'date-fns';
import { settle } from '../../test/settle';

/**
 * 2026-10-29: a disabled Reserve must never be a silent dead end.
 *
 * Measured on the guest-portal lifecycle E2E (about 1 run in 5): one pricing request failed for a transient reason
 * (a dropped connection), the widget printed "Couldn't load prices" in plain text and left Reserve disabled for good,
 * with no way forward except picking the dates again. Pinned here:
 *   - the failure is announced (role="alert") and offers "Try again";
 *   - ONE quiet automatic re-fetch heals a transient failure with no tap at all;
 *   - a second failure stops (no retry loop) and leaves the alert + "Try again" on screen;
 *   - "Try again" re-fetches and clears the alert once the price loads;
 *   - dates that arrive in a link but can never be booked (check-in in the past) say so, with an alert.
 */

const mocks = vi.hoisted(() => ({
  fetchCalendarPricing: vi.fn(),
  fetchGuestPriceBreakdown: vi.fn(),
  booking: { checkIn: null as string | null, checkOut: null as string | null, guests: 2 },
  dailyPricing: { baseAmount: 6000, actualPrice: 6000, globalDiscountPercent: 0 } as Record<string, number>,
}));

vi.mock('@/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasRuntimeConfig: () => true,
}));

vi.mock('@/tenant/tenantContext', () => ({
  getTenantContext: () => ({
    slug: 'atlas',
    name: 'Atlastays',
    paymentProvider: 'RAZORPAY',
    bookingMode: 'ONLINE' as const,
  }),
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
    getListingPricing: () => mocks.dailyPricing,
  }),
}));

vi.mock('@/components/FomoBar', () => ({ default: () => null }));
vi.mock('@/lib/events', () => ({ track: vi.fn() }));
vi.mock('./AtlasBookingCalendar', () => ({ AtlasBookingCalendar: () => null }));

const FIXED_NOW = new Date('2026-02-15T12:00:00Z');
const RANGE_IN = '2026-06-10';
const RANGE_OUT = '2026-06-14';
const futureMonthIso = format(startOfMonth(addMonths(FIXED_NOW, 4)), 'yyyy-MM-dd'); // 2026-06-01

/** A price for every night of the stay, so the nights count as priced once the fetch lands. */
function pricedRange() {
  const dateToPrice = new Map<string, number>();
  for (let d = new Date(2026, 5, 10); d < new Date(2026, 5, 14); d = addDays(d, 1)) dateToPrice.set(format(d, 'yyyy-MM-dd'), 6000);
  return { dateToPrice, convenienceFeePercent: 3 };
}
const emptyPrices = () => Promise.resolve({ dateToPrice: new Map<string, number>(), convenienceFeePercent: 3 });

async function renderWidget() {
  const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
  await act(async () => {
    render(
      <MemoryRouter>
        <UnitBookingWidget listingId={7} propertyId={3} listingName="Atlas 501 PH" propertySlug="atlas501-ph" unitSlug="ph" />
      </MemoryRouter>,
    );
  });
  await settle();
}

const sleep = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

describe('UnitBookingWidget - a failed price never leaves Reserve as a silent dead end', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    mocks.fetchGuestPriceBreakdown.mockResolvedValue(null);
    mocks.booking.checkIn = RANGE_IN;
    mocks.booking.checkOut = RANGE_OUT;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
    mocks.booking.checkIn = null;
    mocks.booking.checkOut = null;
    mocks.dailyPricing = { baseAmount: 6000, actualPrice: 6000, globalDiscountPercent: 0 };
  });

  const callsFor = (monthIso: string) => mocks.fetchCalendarPricing.mock.calls.filter((c) => c[1] === monthIso).length;

  it('announces the failure as an alert and offers Try again', async () => {
    mocks.fetchCalendarPricing.mockImplementation((_id: number, monthIso: string) =>
      monthIso === futureMonthIso ? Promise.reject(new Error('Failed to fetch')) : emptyPrices());

    await renderWidget();

    expect(screen.getByTestId('bw-pricing-error-alert')).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('bw-pricing-error')).toHaveTextContent("Couldn't load prices");
    expect(screen.getByTestId('bw-pricing-retry')).toHaveTextContent('Try again');
    expect(screen.getByTestId('guest-booking-submit')).toBeDisabled();
  });

  it('heals a transient failure with ONE automatic re-fetch, no tap needed', async () => {
    let broken = true; // the connection comes back before the automatic re-fetch fires
    mocks.fetchCalendarPricing.mockImplementation((_id: number, monthIso: string) => {
      if (monthIso !== futureMonthIso) return emptyPrices();
      return broken ? Promise.reject(new Error('net::ERR_FAILED')) : Promise.resolve(pricedRange());
    });

    await renderWidget();
    expect(screen.getByTestId('bw-pricing-error')).toBeInTheDocument(); // the first failure is visible for a moment
    const callsBefore = callsFor(futureMonthIso);

    broken = false;
    await sleep(1_800);
    await settle();

    expect(screen.queryByTestId('bw-pricing-error')).toBeNull();
    expect(screen.queryByTestId('bw-pricing-retry')).toBeNull();
    expect(callsFor(futureMonthIso)).toBe(callsBefore + 1);
  });

  it('stops after the one automatic re-fetch: no retry loop, the alert and Try again stay', async () => {
    mocks.fetchCalendarPricing.mockImplementation((_id: number, monthIso: string) =>
      monthIso === futureMonthIso ? Promise.reject(new Error('net::ERR_FAILED')) : emptyPrices());

    await renderWidget();
    const callsBefore = callsFor(futureMonthIso);
    await sleep(1_800);
    await settle();
    expect(callsFor(futureMonthIso)).toBe(callsBefore + 1); // exactly one automatic re-fetch
    await sleep(1_800);
    await settle();

    expect(callsFor(futureMonthIso)).toBe(callsBefore + 1); // and nothing more on its own
    expect(screen.getByTestId('bw-pricing-error-alert')).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('bw-pricing-retry')).toBeInTheDocument();
    expect(screen.getByTestId('guest-booking-submit')).toBeDisabled();
  });

  it('Try again re-fetches and clears the alert once the price loads', async () => {
    let healthy = false;
    mocks.fetchCalendarPricing.mockImplementation((_id: number, monthIso: string) => {
      if (monthIso !== futureMonthIso) return emptyPrices();
      return healthy ? Promise.resolve(pricedRange()) : Promise.reject(new Error('net::ERR_FAILED'));
    });

    await renderWidget();
    await sleep(1_800); // the automatic re-fetch has been spent and failed too
    await settle();
    expect(screen.getByTestId('bw-pricing-retry')).toBeInTheDocument();
    const callsBefore = callsFor(futureMonthIso);

    healthy = true;
    await act(async () => { fireEvent.click(screen.getByTestId('bw-pricing-retry')); });
    await settle();

    expect(screen.queryByTestId('bw-pricing-error-alert')).toBeNull();
    expect(callsFor(futureMonthIso)).toBe(callsBefore + 1);
  });

  it('dates from a link that are already in the past: Reserve is disabled AND an alert says why', async () => {
    mocks.fetchCalendarPricing.mockImplementation(() => emptyPrices());
    mocks.booking.checkIn = '2026-02-01'; // before "today" (2026-02-15)
    mocks.booking.checkOut = '2026-02-04';

    await renderWidget();

    const notice = screen.getByTestId('guest-booking-date-error');
    expect(notice).toHaveAttribute('role', 'alert');
    expect(notice).toHaveTextContent('Check-in date must be today or in the future.');
    expect(screen.getByTestId('guest-booking-submit')).toBeDisabled();
  });

  it('a price the widget cannot work out (not a number): Reserve is disabled AND an alert says why', async () => {
    mocks.fetchCalendarPricing.mockImplementation((_id: number, monthIso: string) =>
      monthIso === futureMonthIso ? Promise.resolve({ ...pricedRange(), convenienceFeePercent: Number.NaN }) : emptyPrices());

    await renderWidget();

    expect(screen.getByTestId('guest-booking-submit')).toBeDisabled();
    const notice = screen.getByTestId('bw-reserve-blocked-notice');
    expect(notice).toHaveAttribute('role', 'alert');
    expect(notice).toHaveTextContent("We couldn't work out the price");
  });
});
