import React from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { format } from 'date-fns';

import { getIstCalendarDate, toCalendarISO } from '@/utils/date';

/**
 * REGRESSION (sibling of the AtlasBookingCalendar defect fixed in #449): the SEARCH date
 * picker must hand its consumers — and BookingContext — the civil date the guest clicked.
 *
 * The shipped defect: `AtlasDateRangePicker.normalizeDate` was `getIstStartOfDay(date)`, an
 * instant→IST conversion, applied to the LOCAL-midnight Dates react-date-range hands out.
 * That is exactly the shape #449 removed from UnitBookingWidget. Two losses stacked on the
 * search path for a guest east of UTC+05:30:
 *
 *   1. normalizeDate shifted the picked cell to D-1 (the label, the /search URL param).
 *   2. SearchAvailabilityWidget then wrote that local-midnight Date into BookingContext with a
 *      bare `.toISOString()`. The wire format is an IST-midnight INSTANT (UnitBookingWidget
 *      emits `istInstantFromCalendarDate(...)` and hydrates with `getIstCalendarDate`), and a
 *      local-midnight Date does not round-trip through it east of +05:30 — another day lost.
 *
 * So a guest in JST who picked D saw D-1 in the search bar and D-2 in the unit widget, with
 * nothing erroring anywhere.
 *
 * WHY THIS FILE FORCES A TIMEZONE — see the header of calendarDateBasis.tzeast.test.tsx and the
 * TZ-pinned partition note in vitest.config.ts. The `.tzeast.test.tsx` suffix routes this file to
 * the `tz-east-of-ist` project (Asia/Tokyo, forks pool). The zone comes from the RUNNER: setting
 * `process.env.TZ` in here does nothing, because Node has already resolved the zone by the time
 * this module evaluates. The guard block below fails loudly if that pin ever decays, so this
 * file can never turn into a green no-op. Do NOT answer a failure here by pinning TZ globally.
 */

vi.mock('@/utils/analytics', () => ({
  trackEvent: vi.fn(),
  trackPageView: vi.fn(),
}));

// The popover portals in production; render it inline so the calendar grid is queryable.
// Mirrors AtlasDateRangePicker.test.tsx.
vi.mock('@/components/homepage_components/hotelBooking_form/DateRangePickerPopover', () => ({
  DateRangePickerPopover: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="date-picker-popover">{children}</div> : null,
}));

import { AtlasDateRangePicker, type AtlasDateRangePickerValue } from './AtlasDateRangePicker';
import { SearchAvailabilityWidget } from '@/components/availability/SearchAvailabilityWidget';
import { BookingProvider, useBooking } from '@/contexts/BookingContext';

// Mid-month and mid-day, so no runner offset can drag the fixed "now" onto a different civil
// date in either IST or the pinned local zone — every expectation below is unambiguous.
const FIXED_NOW = new Date('2026-02-15T12:00:00Z'); // 17:30 IST on the 15th; 21:00 JST on the 15th
const TODAY_ISO = '2026-02-15';
const PICKED_ISO = '2026-02-20';
const CHECKOUT_ISO = '2026-02-23';

/** The civil date a BookingContext wire value denotes, read back exactly as UnitBookingWidget does. */
const wireToCivilDate = (wire: string | null | undefined): string | null =>
  wire ? toCalendarISO(getIstCalendarDate(new Date(wire))) : null;

describe('search date basis — guard: this suite is actually east of IST', () => {
  it('runs east of UTC+05:30, so the two date bases genuinely diverge here', () => {
    // getTimezoneOffset is minutes WEST of UTC, so east zones are negative. IST is -330.
    expect(new Date().getTimezoneOffset()).toBeLessThan(-330);
  });

  it('a bare toISOString on a local-midnight Date really does lose a day through the wire here', () => {
    // The exact hazard defect (2) above rode on. If this stops holding, the zone is no longer
    // east of IST and the BookingContext cases below are vacuous.
    const localMidnight = new Date(2026, 1, 20);
    expect(format(localMidnight, 'yyyy-MM-dd')).toBe(PICKED_ISO);
    expect(wireToCivilDate(localMidnight.toISOString())).toBe('2026-02-19');
  });
});

// ---------------------------------------------------------------------------
// The picker itself: what it hands a consumer must be the cell the guest clicked.
// ---------------------------------------------------------------------------

describe('AtlasDateRangePicker — hands out the civil date the guest clicked (east of IST)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const renderPicker = (onChange: (v: AtlasDateRangePickerValue) => void) =>
    render(
      <AtlasDateRangePicker
        anchorRef={{ current: document.createElement('div') }}
        open
        onClose={vi.fn()}
        value={{ startDate: null, endDate: null }}
        onChange={onChange}
        minDate={getIstCalendarDate(FIXED_NOW)}
        shownDate={new Date(2026, 1, 1)}
        // date-fns `format` reads LOCAL components, so this testid IS the date printed on the
        // cell — the cell is located the way a guest identifies it, not by any key the
        // component computed for itself.
        dayContentRenderer={(day) => (
          <span data-testid={`cell-${format(day, 'yyyy-MM-dd')}`}>{format(day, 'd')}</span>
        )}
      />,
    );

  // react-date-range's DayCell commits a selection on mousedown+mouseup (see its
  // `handleMouseEvent`); a bare `click` fires no handler at all and would silently assert
  // nothing. It also short-circuits on `disabled`, so this is exactly what a guest can do.
  const selectDay = (iso: string) => {
    const cell = screen.getByTestId(`cell-${iso}`).closest('button');
    expect(cell).toBeTruthy();
    fireEvent.mouseDown(cell!);
    fireEvent.mouseUp(cell!);
  };

  // PROVING CASE for defect (1).
  it('a clicked cell reaches onChange as that same civil date', () => {
    const onChange = vi.fn();
    renderPicker(onChange);

    selectDay(PICKED_ISO);

    expect(onChange).toHaveBeenCalled();
    const { startDate } = onChange.mock.calls.at(-1)![0] as AtlasDateRangePickerValue;
    expect(startDate).toBeTruthy();
    expect(format(startDate!, 'yyyy-MM-dd')).toBe(PICKED_ISO);
  });

  // The quick presets convert an INSTANT (`new Date()`) into calendar basis. That boundary
  // belongs to `getIstCalendarDate`; `getIstStartOfDay` yields an IST-midnight instant, which
  // reads as the property's civil day only by accident east of IST and as the PREVIOUS day
  // everywhere west of it (including UTC, where CI runs).
  it('the "Tonight" preset starts on the property\'s civil today, normalised to calendar basis', () => {
    const onChange = vi.fn();
    renderPicker(onChange);

    fireEvent.click(screen.getByRole('button', { name: 'Tonight' }));

    const { startDate, endDate } = onChange.mock.calls.at(-1)![0] as AtlasDateRangePickerValue;
    expect(format(startDate!, 'yyyy-MM-dd')).toBe(TODAY_ISO);
    expect(format(endDate!, 'yyyy-MM-dd')).toBe('2026-02-16');
    // Calendar basis means LOCAL midnight. An IST-midnight instant lands at 03:30 local here —
    // green on the civil-date assertion above by luck, and a day early west of IST.
    expect(startDate!.getHours()).toBe(0);
    expect(startDate!.getMinutes()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// End to end: cell → SearchAvailabilityWidget → BookingContext wire → UnitBookingWidget's read.
// ---------------------------------------------------------------------------

const Probe: React.FC = () => {
  const { booking } = useBooking();
  const location = useLocation();
  return (
    <>
      <span data-testid="probe-checkin">{booking.checkIn ?? ''}</span>
      <span data-testid="probe-checkout">{booking.checkOut ?? ''}</span>
      <span data-testid="probe-search">{location.search}</span>
    </>
  );
};

describe('SearchAvailabilityWidget — the night written to BookingContext is the night picked (east of IST)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  const renderWidget = (entry = '/') =>
    render(
      <MemoryRouter initialEntries={[entry]}>
        <BookingProvider>
          <SearchAvailabilityWidget />
          <Probe />
        </BookingProvider>
      </MemoryRouter>,
    );

  const openCalendar = async () => {
    await act(async () => {
      fireEvent.click(screen.getByTestId('hero-date-toggle'));
    });
    await screen.findByTestId('date-picker-popover');
  };

  // mousedown+mouseup, not click — see the note on `selectDay` above.
  const selectDay = async (iso: string) => {
    const cell = screen.getByTestId(`hero-date-${iso}`).closest('button');
    expect(cell).toBeTruthy();
    await act(async () => {
      fireEvent.mouseDown(cell!);
      fireEvent.mouseUp(cell!);
    });
  };

  // PROVING CASE for defects (1)+(2) compounding: pre-fix this lands on D-2.
  it('a picked check-in round-trips through the wire format to the same civil date', async () => {
    renderWidget();
    await openCalendar();

    await selectDay(PICKED_ISO);

    // What the guest sees on the field.
    await waitFor(() => {
      expect(screen.getByTestId('hero-date-toggle').textContent).toContain('20 Feb 2026');
    });

    // What UnitBookingWidget will hydrate from BookingContext.
    await waitFor(() => {
      expect(wireToCivilDate(screen.getByTestId('probe-checkin').textContent)).toBe(PICKED_ISO);
    });
  });

  // ?checkIn=/?checkOut= are date-only strings — `new Date('YYYY-MM-DD')` is a UTC-midnight
  // INSTANT, so they need the same boundary conversion as any other instant entering the widget.
  it('URL-param dates survive the round trip into BookingContext', async () => {
    renderWidget(`/search?checkIn=${PICKED_ISO}&checkOut=${CHECKOUT_ISO}`);

    await waitFor(() => {
      expect(wireToCivilDate(screen.getByTestId('probe-checkin').textContent)).toBe(PICKED_ISO);
    });
    expect(wireToCivilDate(screen.getByTestId('probe-checkout').textContent)).toBe(CHECKOUT_ISO);

    // And the field the guest reads agrees with it.
    expect(screen.getByTestId('hero-date-toggle').textContent).toContain('20 Feb 2026');
  });

  // The quick presets are the one guest action that yields a COMPLETE range in a single
  // interaction, so they are what exercises the /search URL sink end to end here. (Completing a
  // range by clicking check-in then check-out is currently impossible for an unrelated,
  // timezone-independent reason — see the note at the bottom of this file.)
  //
  // The preset converts an instant (`new Date()`) to calendar basis; the widget then writes that
  // range to BOTH sinks. Pre-fix east of IST the URL stayed right while BookingContext lost a
  // day — the two sinks disagreeing is the signature of a mixed basis.
  it('a "Tonight" preset lands on the property\'s civil today in BookingContext and in /search', async () => {
    renderWidget();
    await openCalendar();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tonight' }));
    });

    await waitFor(() => {
      expect(wireToCivilDate(screen.getByTestId('probe-checkin').textContent)).toBe(TODAY_ISO);
    });
    expect(wireToCivilDate(screen.getByTestId('probe-checkout').textContent)).toBe('2026-02-16');

    await act(async () => {
      fireEvent.click(screen.getByTestId('hero-search-submit'));
    });

    await waitFor(() => {
      const search = screen.getByTestId('probe-search').textContent ?? '';
      expect(search).toContain(`checkIn=${TODAY_ISO}`);
      expect(search).toContain('checkOut=2026-02-16');
    });
  });
});

/**
 * SEPARATE, PRE-EXISTING, TIMEZONE-INDEPENDENT DEFECT found while writing this file — deliberately
 * NOT covered here, because it is not a date-basis problem and fixing it changes the picker's
 * selection state machine:
 *
 *   `AtlasDateRangePicker` cannot complete a range by clicking check-in and then check-out.
 *   react-date-range commits on mousedown (`dragSelectionEnabled={false}`), and on the second
 *   click `calcNewSelection` takes the `focusedRange[1] === 1` branch: it sets `endDate = value`
 *   and passes `startDate` through UNCHANGED from the `ranges` prop. So `handleRangeChange`
 *   receives `startDate === value.startDate`, and its first guard —
 *   `composedDisabledDay(startDate)`, which returns true for `normalized <= checkIn` while
 *   `selectionState === 'CHECK_IN_SELECTED'` — rejects the whole selection and returns early.
 *   The guest gets "Minimum stay is one night. Select a check-out date after check-in." and no
 *   check-out is ever recorded. Reproduced in Asia/Kolkata (offset -330) as well as here, so it
 *   is unrelated to timezone. Affects both consumers (SearchAvailabilityWidget, AirbnbSearchBar).
 */
