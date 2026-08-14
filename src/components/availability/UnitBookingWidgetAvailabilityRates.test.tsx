import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, format, startOfDay } from 'date-fns';
import { toISODate } from '@/utils/dateRange';
import { getIstStartOfDay } from '@/utils/date';

/**
 * TASK-7491 (Rate Sync Authority opt-out — guest-portal slice): verifies the guest booking
 * calendar fails closed on a `bookable:false` day from GET /api/pricing/availability-rates —
 * rendered unavailable, unselectable, no price — while a `carried_forward` (bookable:true) day
 * and a normal `channel_inbound` day keep rendering exactly as before (unchanged behavior;
 * `bookable` gates rendering, not `priceSource`).
 *
 * Deliberately its own file: UnitBookingWidget.test.tsx mocks `./AtlasBookingCalendar` to
 * `() => null` module-wide (vi.mock is hoisted and file-scoped in Vitest — it cannot be
 * selectively un-mocked for one describe block within that file), so it can never observe real
 * day-cell DOM. This file leaves AtlasBookingCalendar UNMOCKED so the assertions below exercise
 * the actual rendered calendar, matching how a guest would see it.
 */

const mocks = vi.hoisted(() => ({
  fetchCalendarPricing: vi.fn(),
  fetchGuestGstBreakdown: vi.fn(),
  fetchAvailabilityRatesForMonths: vi.fn(),
  booking: { checkIn: null as string | null, checkOut: null as string | null, guests: 2 },
}));

const availabilityCalendarMock = vi.hoisted(() => ({ fetch: vi.fn() }));

const availabilityCalendarOk = () =>
  new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });

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
  dedupedAvailabilityCalendarFetch: (...args: unknown[]) => availabilityCalendarMock.fetch(...args),
}));
availabilityCalendarMock.fetch.mockImplementation(availabilityCalendarOk);
vi.mock('@/api/pricingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchCalendarPricing: mocks.fetchCalendarPricing,
  fetchGuestGstBreakdown: mocks.fetchGuestGstBreakdown,
}));
vi.mock('@/api/availabilityRatesClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchAvailabilityRatesForMonths: mocks.fetchAvailabilityRatesForMonths,
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

describe('UnitBookingWidget - TASK-7491: availability-rates bookable gate (render)', () => {
  // Clock is pinned (see beforeEach) and the fixture days are derived from this same constant
  // rather than from `new Date()`, so collection-time and render-time can never land on
  // different days. Mid-month and mid-day UTC: every fixture day (+4…+6) stays inside February
  // for any runner offset, so both rendered months always contain them.
  const FIXED_NOW = new Date('2026-02-15T12:00:00Z');

  // MonthGrid builds every cell as `new Date(year, month, d)` — LOCAL midnight
  // (AtlasBookingCalendar.tsx, MonthGrid) — so the fixture days must be local-calendar days too,
  // and `findDayCell`'s `format(date, 'd MMMM')` then matches DayCell's identical `format` call
  // exactly. The previous anchor was `getIstStartOfDay()`, an IST *instant*: `toISODate` reads its
  // IST components while `format` reads its LOCAL ones, so in any zone behind IST the mocked ISO
  // and the looked-up cell were a day apart and the assertions read the neighbouring day's price.
  // Under TZ=UTC (CI's zone) that surfaced as `expected '4200' to be '5100'` — the file had never
  // passed on CI, only on IST dev machines.
  const day = (offset: number) => addDays(startOfDay(FIXED_NOW), offset);
  const unusableDate = day(4);
  const carriedForwardDate = day(5);
  const normalDate = day(6);

  // The two maps the widget hands the grid are keyed on DIFFERENT bases, so each fixture key must
  // go through the same function the component does or this file drifts back into zone-dependence:
  //   • calendar prices    → MonthGrid's `toYMD(cell)` — LOCAL y-m-d
  //   • availability rates → `toISODate(getIstStartOfDay(cell))` — UnitBookingWidget.isDateDisabled
  // The two coincide in IST and in UTC and diverge only east of IST; routing each map through its
  // own key keeps the fixture correct in every zone rather than just the two we happen to run.
  const priceKey = (d: Date) => format(d, 'yyyy-MM-dd');
  const rateKey = (d: Date) => toISODate(getIstStartOfDay(d));
  // Deliberately < 10000 so AtlasBookingCalendar's formatINR uses plain "₹N,NNN" (not the "₹N.NK"
  // form it switches to at >= 10000) — irrelevant to the assertions below, which strip non-digits.
  const CARRIED_FORWARD_PRICE = 4200;
  const NORMAL_PRICE = 5100;
  // The breakdown/pricing mock deliberately DOES supply a price for the unusable date — proves
  // the day renders no price because of the bookable gate, not merely because no price exists.
  const INVENTED_PRICE_IF_BUG = 9999;

  beforeEach(() => {
    // Only `Date` is faked: `waitFor`/`findBy*` keep their real setTimeout/setInterval, so the
    // async assertions below behave exactly as they do under real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    availabilityCalendarMock.fetch.mockReset();
    availabilityCalendarMock.fetch.mockImplementation(availabilityCalendarOk);
    mocks.fetchCalendarPricing.mockResolvedValue({
      dateToPrice: new Map([
        [priceKey(unusableDate), INVENTED_PRICE_IF_BUG],
        [priceKey(carriedForwardDate), CARRIED_FORWARD_PRICE],
        [priceKey(normalDate), NORMAL_PRICE],
      ]),
      convenienceFeePercent: 3,
    });
    mocks.fetchGuestGstBreakdown.mockResolvedValue({ gstPercent: 5, gstAmount: 0, finalAmount: 0 });
    mocks.fetchAvailabilityRatesForMonths.mockResolvedValue([
      {
        date: rateKey(unusableDate),
        nightlyRate: 0,
        roomsAvailable: 0,
        isAvailable: false,
        bookable: false,
        reason: 'no_usable_rate',
        priceSource: null,
      },
      {
        date: rateKey(carriedForwardDate),
        nightlyRate: CARRIED_FORWARD_PRICE,
        roomsAvailable: 1,
        isAvailable: true,
        bookable: true,
        reason: null,
        priceSource: 'carried_forward',
      },
      {
        date: rateKey(normalDate),
        nightlyRate: NORMAL_PRICE,
        roomsAvailable: 1,
        isAvailable: true,
        bookable: true,
        reason: null,
        priceSource: 'channel_inbound',
      },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
    mocks.booking.checkIn = null;
    mocks.booking.checkOut = null;
  });

  const renderWidgetAndOpenCalendar = async () => {
    const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
    render(
      <MemoryRouter>
        <UnitBookingWidget
          listingId={7}
          propertyId={3}
          listingName="Atlas 501 PH"
          propertySlug="atlas501-ph"
          unitSlug="ph"
        />
      </MemoryRouter>,
    );
    const trigger = await screen.findByLabelText('Select check-in date');
    await act(async () => {
      fireEvent.click(trigger);
    });
    await screen.findByRole('dialog', { name: 'Select dates' });
  };

  const findDayCell = async (date: Date): Promise<HTMLElement> => {
    const label = format(date, 'd MMMM');
    // aria-label is `${d MMMM}` optionally followed by `, ₹price` (DayCell in
    // AtlasBookingCalendar.tsx) — match the date prefix regardless of the price suffix.
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return screen.findByRole('gridcell', { name: new RegExp(`^${escaped}(,|$)`) });
  };

  it('renders a bookable:false day unavailable: disabled, unselectable, no price ever shown', async () => {
    await renderWidgetAndOpenCalendar();

    const cell = await findDayCell(unusableDate);
    await waitFor(() => {
      expect(cell).toBeDisabled();
    });
    expect(cell.className).toContain('bc-unavail');
    // No price span at all for this cell — never a guessed/invented price.
    expect(cell.querySelector('.bc-price')).toBeNull();
    // The breakdown mock DID supply a price (₹9,999) for this exact date; it must never surface.
    expect(screen.queryByText('₹9,999')).toBeNull();
    expect(screen.queryByText(String(INVENTED_PRICE_IF_BUG))).toBeNull();

    // Unselectable: a click must not be able to pick it as check-in — the trigger still shows
    // the empty placeholder, never the clicked (unusable) date.
    fireEvent.click(cell);
    expect(screen.getByLabelText('Select check-in date').textContent).toContain('Add date');
  });

  it('a carried_forward day (bookable:true) stays selectable and keeps showing its carried price (unchanged)', async () => {
    await renderWidgetAndOpenCalendar();

    const cell = await findDayCell(carriedForwardDate);
    await waitFor(() => {
      expect(cell.querySelector('.bc-price')).not.toBeNull();
    });
    expect(cell).not.toBeDisabled();
    expect(cell.className).not.toContain('bc-unavail');
    const priceText = cell.querySelector('.bc-price')?.textContent?.replace(/[^0-9]/g, '');
    expect(priceText).toBe(String(CARRIED_FORWARD_PRICE));
  });

  it('a normal channel_inbound day (bookable:true) is unchanged: selectable, shows its price', async () => {
    await renderWidgetAndOpenCalendar();

    const cell = await findDayCell(normalDate);
    await waitFor(() => {
      expect(cell.querySelector('.bc-price')).not.toBeNull();
    });
    expect(cell).not.toBeDisabled();
    expect(cell.className).not.toContain('bc-unavail');
    const priceText = cell.querySelector('.bc-price')?.textContent?.replace(/[^0-9]/g, '');
    expect(priceText).toBe(String(NORMAL_PRICE));
  });
});
