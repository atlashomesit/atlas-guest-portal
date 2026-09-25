import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { format } from 'date-fns';

/**
 * TASK-102076: picking a new check-in that invalidates the held check-out
 * (equal to or later than it) must auto-advance check-out to check-in + 1 night
 * instead of surfacing the 'Check-out date must be after check-in date' error,
 * and must move focus to the check-out field (via onActiveFieldChange).
 *
 * Conventions borrowed from AtlasDateRangePicker.rangeCompletion.test.tsx: the
 * picker is controlled so `value` round-trips through the parent, days are found
 * by the date printed on the cell, and selection commits on mousedown+mouseup.
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

const Harness: React.FC<{
  onChange: (value: AtlasDateRangePickerValue) => void;
  onActiveFieldChange?: (field: 'checkin' | 'checkout' | null) => void;
}> = ({ onChange, onActiveFieldChange }) => {
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
      onActiveFieldChange={onActiveFieldChange}
      minDate={MIN_DATE}
      shownDate={MIN_DATE}
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

const selectDay = (iso: string) => {
  const cell = cellButton(iso);
  fireEvent.mouseDown(cell);
  fireEvent.mouseUp(cell);
};

const isoOf = (date: Date | null | undefined) => (date ? format(date, 'yyyy-MM-dd') : null);

describe('AtlasDateRangePicker — TASK-102076 check-out auto-advance', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('picking a check-in on/after the held check-out advances check-out to check-in + 1 with no error and focuses checkout', () => {
    const onChange = vi.fn();
    const onActiveFieldChange = vi.fn();
    render(<Harness onChange={onChange} onActiveFieldChange={onActiveFieldChange} />);

    // Build a completed range first: May 20 -> May 23.
    selectDay(CHECK_IN);
    selectDay(CHECK_OUT);
    expect(onChange).toHaveBeenCalledTimes(2);

    // Pick a new check-in AFTER the held check-out (May 25 > May 23).
    selectDay('2026-05-25');

    expect(onChange).toHaveBeenCalledTimes(3);
    const last = onChange.mock.calls.at(-1)![0] as AtlasDateRangePickerValue;
    expect(isoOf(last.startDate)).toBe('2026-05-25');
    expect(isoOf(last.endDate)).toBe('2026-05-26');

    // No disruptive error for the auto-corrected case…
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/must be after check-in/i)).toBeNull();

    // …focus moves to the check-out field: the picker holds step 2 (not a
    // completed range) so the next click completes the real check-out.
    expect(onActiveFieldChange).toHaveBeenCalledWith('checkout');
    expect(screen.getByText('Step 2: Select your check-out date')).toBeInTheDocument();
  });

  it('picking a check-in equal to the held check-out also auto-advances', () => {
    const onChange = vi.fn();
    const onActiveFieldChange = vi.fn();
    render(<Harness onChange={onChange} onActiveFieldChange={onActiveFieldChange} />);

    selectDay(CHECK_IN);
    selectDay(CHECK_OUT);

    // New check-in == held check-out (May 23): zero-night stay without correction.
    selectDay(CHECK_OUT);

    const last = onChange.mock.calls.at(-1)![0] as AtlasDateRangePickerValue;
    expect(isoOf(last.startDate)).toBe(CHECK_OUT);
    expect(isoOf(last.endDate)).toBe('2026-05-24');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onActiveFieldChange).toHaveBeenCalledWith('checkout');
    expect(screen.getByText('Step 2: Select your check-out date')).toBeInTheDocument();
  });

  it('the guest completes their real check-out with the next click after an auto-advance', () => {
    const onChange = vi.fn();
    const onActiveFieldChange = vi.fn();
    render(<Harness onChange={onChange} onActiveFieldChange={onActiveFieldChange} />);

    selectDay(CHECK_IN);
    selectDay(CHECK_OUT);

    // New check-in invalidates the held check-out → provisional +1 night…
    selectDay('2026-05-25');
    const provisional = onChange.mock.calls.at(-1)![0] as AtlasDateRangePickerValue;
    expect(isoOf(provisional.startDate)).toBe('2026-05-25');
    expect(isoOf(provisional.endDate)).toBe('2026-05-26');

    // …then the guest picks their real check-out and the range completes.
    selectDay('2026-05-28');
    const last = onChange.mock.calls.at(-1)![0] as AtlasDateRangePickerValue;
    expect(isoOf(last.startDate)).toBe('2026-05-25');
    expect(isoOf(last.endDate)).toBe('2026-05-28');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Range selected: 3 nights')).toBeInTheDocument();
  });
});
