import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { format } from 'date-fns';

/**
 * REGRESSION: a guest could select a check-in but NEVER a check-out. Two clicks, one range —
 * the single most basic thing this picker exists to do — and it was broken on both consumers
 * (SearchAvailabilityWidget's hero bar and AirbnbSearchBar).
 *
 * Mechanism: the picker passes `dragSelectionEnabled={false}`, so react-date-range commits on
 * MOUSEDOWN — one commit per click. On the second click `DateRange.calcNewSelection` takes its
 * `focusedRange[1] === 1` branch, which sets `endDate = <clicked day>` and passes `startDate`
 * through UNCHANGED from the `ranges` prop. `handleRangeChange` therefore received
 * `startDate === value.startDate`, and its first guard ran that echoed value through
 * `composedDisabledDay`, which reports true for `normalized <= checkIn` while the picker is in
 * CHECK_IN_SELECTED. The check-in always equals itself, so the guard fired on every second
 * click and dropped the whole selection: one onChange, no check-out, and the guest was shown
 * "Minimum stay is one night. Select a check-out date after check-in."
 *
 * The `<= checkIn` rule is a CHECK-OUT CANDIDATE rule. It belongs to `endDate`, never to the
 * echoed `startDate`. Nothing here is timezone-dependent — it reproduced identically in
 * Asia/Kolkata and Asia/Tokyo — so this file deliberately does NOT force a zone; see
 * searchDateBasis.tzeast.test.tsx for the date-basis cases that must.
 */

// The popover portals in production; render it inline so the calendar grid is queryable.
vi.mock('../homepage_components/hotelBooking_form/DateRangePickerPopover', () => ({
  DateRangePickerPopover: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="date-picker-popover">{children}</div> : null,
}));

import { AtlasDateRangePicker, type AtlasDateRangePickerValue } from './AtlasDateRangePicker';

const MIN_DATE = new Date(2026, 4, 1); // 1 May 2026, local midnight — calendar basis
const CHECK_IN = '2026-05-20';
const CHECK_OUT = '2026-05-23';

/**
 * The picker is a controlled component: react-date-range echoes `ranges[0].startDate` back on
 * the second click, so the defect only exists when `value` actually round-trips through the
 * parent. A test that passed a frozen `value` would never see it.
 */
const Harness: React.FC<{
  onChange: (value: AtlasDateRangePickerValue) => void;
  disabledDay?: (date: Date) => boolean;
}> = ({ onChange, disabledDay }) => {
  const [value, setValue] = React.useState<AtlasDateRangePickerValue>({
    startDate: null,
    endDate: null,
  });
  return (
    <AtlasDateRangePicker
      anchorRef={{ current: document.createElement('div') }}
      open
      onClose={vi.fn()}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      minDate={MIN_DATE}
      shownDate={MIN_DATE}
      disabledDay={disabledDay}
      // date-fns `format` reads LOCAL components, so this testid IS the date printed on the
      // cell: days are located exactly the way a guest identifies them.
      dayContentRenderer={(day) => (
        <span data-testid={`cell-${format(day, 'yyyy-MM-dd')}`}>{format(day, 'd')}</span>
      )}
    />
  );
};

const cellButton = (iso: string) => {
  const cell = screen.getByTestId(`cell-${iso}`).closest('button');
  expect(cell).toBeTruthy();
  return cell!;
};

// react-date-range's DayCell commits on mousedown+mouseup (`handleMouseEvent`); a bare `click`
// fires no handler at all and would silently assert nothing. It short-circuits on `disabled`,
// so this is exactly — and only — what a guest can do.
const selectDay = (iso: string) => {
  const cell = cellButton(iso);
  fireEvent.mouseDown(cell);
  fireEvent.mouseUp(cell);
};

const isoOf = (date: Date | null | undefined) => (date ? format(date, 'yyyy-MM-dd') : null);

describe('AtlasDateRangePicker — completing a range in two clicks', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // PROVING CASE. Pre-fix: exactly ONE onChange arrives, {startDate: CHECK_IN, endDate: null}.
  it('records the check-out on the second click', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    selectDay(CHECK_IN);

    expect(onChange).toHaveBeenCalledTimes(1);
    const first = onChange.mock.calls[0][0] as AtlasDateRangePickerValue;
    expect(isoOf(first.startDate)).toBe(CHECK_IN);
    expect(first.endDate).toBeNull();

    selectDay(CHECK_OUT);

    expect(onChange).toHaveBeenCalledTimes(2);
    const second = onChange.mock.calls[1][0] as AtlasDateRangePickerValue;
    expect(isoOf(second.startDate)).toBe(CHECK_IN);
    expect(isoOf(second.endDate)).toBe(CHECK_OUT);
  });

  it('shows no validation error on a valid two-click range, and reports the nights', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    selectDay(CHECK_IN);
    selectDay(CHECK_OUT);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Range selected: 3 nights')).toBeInTheDocument();
  });

  it('walks the guest through step 1 then step 2', () => {
    render(<Harness onChange={vi.fn()} />);

    expect(screen.getByText('Step 1: Select your check-in date')).toBeInTheDocument();
    selectDay(CHECK_IN);
    expect(screen.getByText('Step 2: Select your check-out date')).toBeInTheDocument();
  });

  // A third click starts a new stay rather than extending the finished one.
  it('starts over from a completed range', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    selectDay(CHECK_IN);
    selectDay(CHECK_OUT);
    selectDay('2026-05-26');

    const last = onChange.mock.calls.at(-1)![0] as AtlasDateRangePickerValue;
    expect(isoOf(last.startDate)).toBe('2026-05-26');
    expect(last.endDate).toBeNull();
    expect(screen.getByText('Step 2: Select your check-out date')).toBeInTheDocument();
  });
});

describe('AtlasDateRangePicker — the 1-night minimum is still enforced', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // The enforcement lives in the grid: once a check-in is held, no day on or before it can be
  // clicked as the check-out. This is what must NOT be traded away to fix the second click.
  it('greys out the check-in itself and every earlier day once a check-in is held', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    expect(cellButton(CHECK_IN).className).not.toContain('rdrDayDisabled');

    selectDay(CHECK_IN);

    expect(cellButton(CHECK_IN).className).toContain('rdrDayDisabled');
    expect(cellButton('2026-05-19').className).toContain('rdrDayDisabled');
    expect(cellButton(CHECK_OUT).className).not.toContain('rdrDayDisabled');
  });

  it('ignores a click on the check-in itself rather than committing a zero-night stay', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    selectDay(CHECK_IN);
    onChange.mockClear();

    selectDay(CHECK_IN);

    expect(onChange).not.toHaveBeenCalled();
  });

  // The consumers pass `disabledDay` for past days (and, on the unit pages, for booked nights).
  // Splitting the check-out rule out of the guard must not let those through.
  it('still rejects a check-out the consumer marked unavailable', () => {
    const onChange = vi.fn();
    const blocked = new Date(2026, 4, 23); // CHECK_OUT
    render(
      <Harness
        onChange={onChange}
        disabledDay={(date) => format(date, 'yyyy-MM-dd') === format(blocked, 'yyyy-MM-dd')}
      />,
    );

    selectDay(CHECK_IN);
    onChange.mockClear();

    selectDay(CHECK_OUT);
    expect(onChange).not.toHaveBeenCalled();

    // …and an available later day still completes the range.
    selectDay('2026-05-24');
    const last = onChange.mock.calls.at(-1)![0] as AtlasDateRangePickerValue;
    expect(isoOf(last.startDate)).toBe(CHECK_IN);
    expect(isoOf(last.endDate)).toBe('2026-05-24');
  });
});
