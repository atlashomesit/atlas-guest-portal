import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, format, startOfDay } from 'date-fns';

/**
 * REGRESSION: the booking calendar's availability gate must evaluate the SAME night the guest
 * sees and clicks, in every guest timezone.
 *
 * The shipped defect (found 2026-08-14): AtlasBookingCalendar builds each cell as
 * `new Date(y, m, d)` — LOCAL midnight — and keyed it by local components, while
 * UnitBookingWidget keyed that same cell via `toISODate(getIstStartOfDay(cell))`, an
 * instant→IST conversion. For any guest east of UTC+05:30 a local-midnight Date lands on the
 * PREVIOUS IST day, so `disabledDay` / `isCheckInAllowed` gated on D-1 while the guest saw D —
 * and the reserve payload sent D-1 too, so the hold was created for a night the guest was never
 * shown. Nothing errored; the two sides were consistently wrong.
 *
 * WHY THIS FILE FORCES A TIMEZONE: the bug is invisible at or west of +05:30, and BOTH zones the
 * suite normally runs in (UTC on CI, Asia/Kolkata on dev machines) sit on the side where the two
 * bases coincide. A suite that only runs there cannot catch this class of defect no matter how
 * many cases it adds. So this file pins Asia/Tokyo (+09:00) itself rather than depending on the
 * runner's zone — and asserts up front that it really is east of IST, so it can never silently
 * decay into a no-op that passes while protecting nothing.
 *
 * Do NOT "fix" a future failure here by pinning TZ globally in vitest.config.ts: that would put
 * the whole suite on the accidentally-correct side of the split and freeze this bug invisible.
 */

/**
 * THE ZONE COMES FROM THE RUNNER, NOT FROM THIS FILE. The `.tzeast.test.tsx` suffix routes this
 * file to the `tz-east-of-ist` project in vitest.config.ts, which sets TZ=Asia/Tokyo for the
 * worker. Setting `process.env.TZ` here instead does NOT work — Node has already resolved and
 * cached the zone by the time a test module evaluates, so the assignment is accepted and simply
 * has no effect, leaving the file running in the runner's own zone and asserting nothing. The
 * guard block below exists to make that failure mode loud instead of silent.
 */

describe('calendar date basis — guard: this suite is actually east of IST', () => {
  it('runs east of UTC+05:30, so the two date bases genuinely diverge here', () => {
    // getTimezoneOffset is minutes WEST of UTC, so east zones are negative.
    // IST is -330; anything more negative is east of it.
    expect(new Date().getTimezoneOffset()).toBeLessThan(-330);
  });

  it('a local-midnight cell really does fall on the previous IST day here', async () => {
    // This is the exact divergence the product bug rode on. If this assertion ever stops
    // holding, the zone above is no longer east of IST and every test below is vacuous.
    const { getIstStartOfDay, toCalendarISO } = await import('@/utils/date');
    const { toISODate } = await import('@/utils/dateRange');

    const cell = new Date(2026, 7, 20); // how MonthGrid builds every cell
    cell.setHours(0, 0, 0, 0);

    expect(toCalendarISO(cell)).toBe('2026-08-20');
    // The legacy instant-basis path — kept here purely to prove the hazard is live in this zone.
    expect(toISODate(getIstStartOfDay(cell))).toBe('2026-08-19');
  });
});

describe('calendar date basis — helpers', () => {
  it('toCalendarISO keys a calendar cell to the civil date the guest sees', async () => {
    const { toCalendarISO } = await import('@/utils/date');
    for (const [y, m, d, expected] of [
      [2026, 0, 1, '2026-01-01'],
      [2026, 7, 20, '2026-08-20'],
      [2026, 11, 31, '2026-12-31'],
    ] as const) {
      expect(toCalendarISO(new Date(y, m, d))).toBe(expected);
    }
  });

  it('getIstCalendarDate turns an instant into the IST civil date, not a shifted one', async () => {
    const { getIstCalendarDate, toCalendarISO } = await import('@/utils/date');
    // 2026-08-20T00:00Z is 05:30 IST on the 20th — the civil date is the 20th, even though
    // local (Tokyo) wall-clock for that instant is already 09:00 on the 20th.
    expect(toCalendarISO(getIstCalendarDate(new Date('2026-08-20T00:00:00Z')))).toBe('2026-08-20');
    // 2026-08-19T20:00Z is 01:30 IST on the 20th — still the 20th in IST, though Tokyo says the 20th too.
    expect(toCalendarISO(getIstCalendarDate(new Date('2026-08-19T20:00:00Z')))).toBe('2026-08-20');
    // 2026-08-19T18:00Z is 23:30 IST on the 19th — the 19th, though Tokyo already says the 20th.
    expect(toCalendarISO(getIstCalendarDate(new Date('2026-08-19T18:00:00Z')))).toBe('2026-08-19');
  });

  it('BookingContext wire format round-trips: calendar date → ISO instant → same calendar date', async () => {
    const { getIstCalendarDate, istInstantFromCalendarDate, toCalendarISO } = await import('@/utils/date');
    // handleReserve writes this into BookingContext; the hydration effect reads it back.
    // A bare `.toISOString()` on a local-midnight Date loses a day here.
    const picked = new Date(2026, 7, 20);
    const wire = istInstantFromCalendarDate(picked).toISOString();
    expect(toCalendarISO(getIstCalendarDate(new Date(wire)))).toBe('2026-08-20');
  });

  it('calculateNights counts civil nights, not elapsed 24h blocks', async () => {
    const { calculateNights } = await import('@/utils/dateHelpers');
    expect(calculateNights(new Date(2026, 7, 20), new Date(2026, 7, 23))).toBe(3);
    expect(calculateNights(new Date(2026, 7, 20), new Date(2026, 7, 21))).toBe(1);
    expect(calculateNights(new Date(2026, 7, 20), new Date(2026, 7, 20))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Component-level: the night the guest SEES is the night that gets gated.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  fetchCalendarPricing: vi.fn(),
  fetchGuestGstBreakdown: vi.fn(),
  fetchAvailabilityRatesForMonths: vi.fn(),
  booking: { checkIn: null as string | null, checkOut: null as string | null, guests: 2 },
}));

const availabilityCalendarMock = vi.hoisted(() => ({ fetch: vi.fn() }));

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

describe('UnitBookingWidget — the gated night is the night the guest sees (east of IST)', () => {
  // Pinned clock: collection-time and render-time can never land on different days.
  // Mid-month so every fixture day stays inside the same month for any runner offset.
  const FIXED_NOW = new Date('2026-02-15T12:00:00Z');

  // Cells are built LOCAL (`new Date(y, m, d)`), so fixtures must be local-calendar days too —
  // and the API key is the civil date, which is exactly what `format(d,'yyyy-MM-dd')` yields.
  const day = (offset: number) => addDays(startOfDay(FIXED_NOW), offset);
  const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');

  const blockedDay = day(5);
  const neighbourBefore = day(4); // control: never blocked, before or after the fix
  // The cell the defect actually disabled. East of IST the gate keyed cell X to X-1, so the
  // cell whose key resolved to the booked night B was cell B+1 — the block landed one day
  // LATE: the booked night stayed clickable and the free night after it was refused.
  const dayAfterBlocked = day(6);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    availabilityCalendarMock.fetch.mockReset();
    // The availability calendar marks exactly ONE night as Booked.
    availabilityCalendarMock.fetch.mockImplementation(
      () =>
        new Response(JSON.stringify([{ date: dayKey(blockedDay), status: 'Booked' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    mocks.fetchCalendarPricing.mockResolvedValue({
      dateToPrice: new Map([
        [dayKey(neighbourBefore), 5000],
        [dayKey(blockedDay), 5000],
        [dayKey(dayAfterBlocked), 5000],
      ]),
      convenienceFeePercent: 3,
    });
    mocks.fetchGuestGstBreakdown.mockResolvedValue({ gstPercent: 5, gstAmount: 0, finalAmount: 0 });
    mocks.fetchAvailabilityRatesForMonths.mockResolvedValue([]);
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

  // The cell is located the way a GUEST identifies it: by the date printed on it (DayCell's
  // aria-label uses `format(date,'d MMMM')` on the local cell date). So this asserts against
  // what is actually on screen, not against any key the component computed.
  const findDayCell = async (date: Date): Promise<HTMLElement> => {
    const label = format(date, 'd MMMM');
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return screen.findByRole('gridcell', { name: new RegExp(`^${escaped}(,|$)`) });
  };

  // PROVING CASE. Verified red against the pre-fix components in this zone:
  // "Received element is not disabled" — the booked night was freely clickable.
  it('disables the booked night itself', async () => {
    await renderWidgetAndOpenCalendar();

    const blockedCell = await findDayCell(blockedDay);
    await waitFor(() => {
      expect(blockedCell).toBeDisabled();
    });
    expect(blockedCell.className).toContain('bc-unavail');
  });

  // PROVING CASE. Verified red against the pre-fix components in this zone:
  // "Received element is disabled" — the block landed on this free night instead.
  it('leaves the night AFTER the booked one selectable, and picks the date actually clicked', async () => {
    await renderWidgetAndOpenCalendar();

    const openCell = await findDayCell(dayAfterBlocked);
    expect(openCell).not.toBeDisabled();
    expect(openCell.className).not.toContain('bc-unavail');

    fireEvent.click(openCell);
    // The trigger shows the date the guest actually clicked — the selection was keyed to the
    // visible cell, not silently shifted a day.
    await waitFor(() => {
      expect(screen.getByLabelText('Select check-in date').textContent).not.toContain('Add date');
    });
    expect(screen.getByLabelText('Select check-in date').textContent).toContain(
      format(dayAfterBlocked, 'd'),
    );
  });

  it('control: an unrelated night well clear of the block stays selectable', async () => {
    await renderWidgetAndOpenCalendar();

    const neighbourCell = await findDayCell(neighbourBefore);
    await waitFor(() => {
      expect(screen.getByLabelText('Select check-in date')).toBeInTheDocument();
    });
    expect(neighbourCell).not.toBeDisabled();
    expect(neighbourCell.className).not.toContain('bc-unavail');
  });
});
