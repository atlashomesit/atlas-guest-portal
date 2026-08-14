import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { formatDisplayNumber } from '@/config/contact';

import { DateRangePickerPopover } from '../homepage_components/hotelBooking_form/DateRangePickerPopover';
// CALENDAR basis throughout this picker — see the header comment in utils/date.ts.
// react-date-range builds every day cell as a LOCAL-midnight Date (a civil date, not an
// instant), and date-fns reads it back on the same basis, so that is the basis this component
// both consumes and hands to its consumers. Instants (`new Date()`) are converted at the
// boundary with getIstCalendarDate and never leak inward.
import { getIstCalendarDate, startOfCalendarDay } from '@/utils/date';

// Helper to normalize date to start of month (avoids timezone issues with date-fns startOfMonth)
const normalizeToStartOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const normalizeDate = (date: Date | null): Date | null => {
  if (!date) return null;
  // CALENDAR basis. This was `getIstStartOfDay(date)` — an instant→IST conversion applied to the
  // local-midnight cells react-date-range hands out, i.e. the exact defect fixed for the booking
  // calendar in #449. East of UTC+05:30 local midnight of day D is still D-1 in IST, so every
  // date leaving this picker was shifted a day back: the guest's own selection came back wrong.
  return startOfCalendarDay(date);
};

export interface AtlasDateRangePickerValue {
  startDate: Date | null;
  endDate: Date | null;
}

interface AtlasDateRangePickerProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  value: AtlasDateRangePickerValue;
  onChange: (value: AtlasDateRangePickerValue) => void;
  heading?: string;
  labelId?: string;
  contentId?: string;
  loadingLabel?: string;
  loading?: boolean;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  disabledDay?: (date: Date) => boolean;
  months?: number;
  shownDate?: Date;
  onShownDateChange?: (date: Date) => void;
  dayContentRenderer?: (date: Date) => React.ReactNode;
  rangeColors?: string[];
  calendarRef?: React.RefObject<HTMLDivElement | null>;
  dateRangeProps?: Partial<React.ComponentProps<typeof DateRange>>;
  afterCalendar?: React.ReactNode;
  activeField?: 'checkin' | 'checkout' | null;
  instructionText?: string;
  popoverClassName?: string;
}

export const AtlasDateRangePicker: React.FC<AtlasDateRangePickerProps> = ({
  anchorRef,
  calendarRef,
  contentId,
  dateRangeProps,
  dayContentRenderer,
  disabledDates,
  disabledDay,
  afterCalendar,
  instructionText = 'Select check-in date, then check-out date from the calendar',
  heading = 'Choose your stay dates',
  labelId,
  loading,
  loadingLabel = 'Loading calendar…',
  maxDate,
  minDate,
  months = 1,
  onChange,
  onClose,
  onShownDateChange,
  open,
  popoverClassName,
  rangeColors,
  shownDate,
  value,
  activeField,
}) => {
  void activeField; // reserved for future focus management
  const fallbackLabelId = useId();
  const fallbackContentId = useId();
  const fallbackCalendarRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = calendarRef ?? fallbackCalendarRef;
  const [validationError, setValidationError] = useState<string | null>(null);

  const [internalShownDate, setInternalShownDate] = useState<Date>(() => {
    const initial = shownDate ?? value.startDate ?? minDate ?? new Date();
    return normalizeToStartOfMonth(initial);
  });

  const [selectionState, setSelectionState] = useState<'IDLE' | 'CHECK_IN_SELECTED' | 'RANGE_SELECTED'>(() => {
    if (value.startDate && value.endDate) return 'RANGE_SELECTED';
    if (value.startDate) return 'CHECK_IN_SELECTED';
    return 'IDLE';
  });

  /** TASK-1712: Quick-preset date ranges */
  const quickPresets = useMemo(() => {
    // The property's "today" is the IST civil date, carried on the calendar basis so it lines up
    // with the grid's cells (and with UnitBookingWidget's `today`) in every guest timezone.
    // `getIstStartOfDay` here returned an IST-midnight INSTANT, which reads as the right civil
    // day only by luck east of IST and as the PREVIOUS day everywhere west of +05:30 — including
    // UTC, so a guest in London or New York got yesterday's presets.
    const today = getIstCalendarDate();
    const dayOfWeek = today.getDay(); // 0=Sun … 6=Sat

    // Next Friday (0 if today is Friday)
    const daysUntilFriday = ((5 - dayOfWeek) + 7) % 7;
    const nextFriday = addDays(today, daysUntilFriday);
    const nextSunday = addDays(nextFriday, 2);

    // "This weekend": if today is Sat use today→Sun, otherwise Fri→Sun
    const thisWeekendStart = dayOfWeek === 6 ? today : nextFriday;
    const thisWeekendEnd   = dayOfWeek === 6 ? addDays(today, 1) : nextSunday;

    // "Next weekend": 7 days after this weekend's Friday
    const nextWeekendStart = addDays(nextFriday, 7);
    const nextWeekendEnd   = addDays(nextSunday, 7);

    // "This week": today → nearest Sunday (next Sunday if today is Sunday)
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    const thisWeekEnd = addDays(today, daysUntilSunday);

    // "Next month": first of next month, 7 nights
    const nextMonthFirst = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthEnd   = addDays(nextMonthFirst, 7);

    const isDisabled = (start: Date) => {
      if (!minDate) return false;
      return startOfCalendarDay(start) < startOfCalendarDay(minDate);
    };

    return [
      { label: 'Tonight',      start: today,           end: addDays(today, 1),  disabled: isDisabled(today) },
      { label: 'This weekend', start: thisWeekendStart, end: thisWeekendEnd,     disabled: isDisabled(thisWeekendStart) },
      { label: 'Next weekend', start: nextWeekendStart, end: nextWeekendEnd,     disabled: isDisabled(nextWeekendStart) },
      { label: 'This week',    start: today,            end: thisWeekEnd,        disabled: isDisabled(today) },
      { label: 'Next month',   start: nextMonthFirst,   end: nextMonthEnd,       disabled: isDisabled(nextMonthFirst) },
    ];
  }, [minDate]);

  // differenceInCalendarDays, not an epoch-millis divide: on the calendar basis a guest whose
  // zone crosses a DST boundary mid-stay has 23h and 25h civil days, and the old arithmetic
  // miscounted those nights (same correction #449 made to calculateNights).
  const nights =
    value.startDate && value.endDate
      ? Math.max(1, differenceInCalendarDays(value.endDate, value.startDate))
      : null;

  useEffect(() => {
    if (value.startDate && value.endDate) {
      setSelectionState('RANGE_SELECTED');
    } else if (value.startDate) {
      setSelectionState('CHECK_IN_SELECTED');
    } else {
      setSelectionState('IDLE');
    }
  }, [value.startDate, value.endDate]);

  const shouldShowInstruction = !value.startDate && !value.endDate;

  const validateDateRange = (checkIn: Date | null, checkOut: Date | null) => {
    if (!checkIn || !checkOut) return { valid: true, error: null };
    // Civil nights, not elapsed 24h blocks — see the note on `nights` above.
    const diffDays = differenceInCalendarDays(checkOut, checkIn);
    if (checkOut <= checkIn) {
      return { valid: false, error: 'Check-out date must be after check-in date' };
    }
    if (diffDays < 1) {
      return { valid: false, error: 'Minimum stay is 1 night. Check-out must be at least 1 day after check-in' };
    }
    if (diffDays > 30) {
      const contactNum = formatDisplayNumber();
      return { valid: false, error: `Maximum stay is 30 nights. For longer stays, please contact us${contactNum ? ` at ${contactNum}` : ''}.` };
    }
    return { valid: true, error: null };
  };

  const applySelection = (startDate: Date | null, endDate: Date | null) => {
    const validation = validateDateRange(startDate, endDate);
    if (!validation.valid) {
      setValidationError(validation.error);
      return false;
    }
    setValidationError(null);
    onChange({ startDate, endDate });
    return true;
  };

  /** TASK-1712: Apply a quick-preset range and close the popover. */
  const handlePresetClick = (start: Date, end: Date) => {
    if (applySelection(start, end)) {
      setSelectionState('RANGE_SELECTED');
      setInternalShownDate(normalizeToStartOfMonth(start));
      onClose();
    }
  };

  /**
   * Reasons a day is unselectable whichever end of the stay is being picked: outside the
   * min/max window, or vetoed by the consumer (past days on both search bars, booked nights on
   * the unit pages).
   */
  const isDayUnavailable = (date: Date) => {
    const normalized = normalizeDate(date);
    if (minDate && normalized && normalized < normalizeDate(minDate)!) return true;
    if (maxDate && normalized && normalized > normalizeDate(maxDate)!) return true;
    return disabledDay ? disabledDay(date) : false;
  };

  /**
   * The 1-night minimum, stated as what it actually is: a rule about a CHECK-OUT CANDIDATE,
   * which may not land on or before the check-in. It says nothing about a check-in, and in
   * particular nothing about the check-in we already hold — see handleRangeChange.
   */
  const isTooEarlyForCheckout = (date: Date) => {
    const normalized = normalizeDate(date);
    const checkIn = normalizeDate(value.startDate);
    return !!(checkIn && normalized && normalized <= checkIn);
  };

  // What the grid greys out. During step 2 that includes every day that cannot be the check-out,
  // which is where the 1-night minimum is enforced against the guest: react-date-range's DayCell
  // short-circuits on `disabled`, so those days cannot even be clicked.
  const composedDisabledDay = (date: Date) =>
    isDayUnavailable(date) ||
    (selectionState === 'CHECK_IN_SELECTED' && isTooEarlyForCheckout(date));

  const handleRangeChange = (ranges: { selection?: { startDate?: Date | null; endDate?: Date | null } }) => {
    const selection = ranges.selection ?? { startDate: null, endDate: null };
    const startDate = normalizeDate(selection.startDate ?? null);
    const endDate = normalizeDate(selection.endDate ?? null);
    const existingCheckIn = normalizeDate(value.startDate);

    // react-date-range commits a CHECK-OUT by setting `endDate` alone and passing `startDate`
    // straight back out of the `ranges` prop untouched (DateRange.calcNewSelection, the
    // `focusedRange[1] === 1` branch). With dragSelectionEnabled={false} that commit happens on
    // mousedown, one per click, so the second click always arrives here as
    // `startDate === value.startDate` — an echo of what we already hold, not a day the guest
    // clicked. Judging it by the check-out rules dropped EVERY valid completion: the check-in
    // equals itself, so `<= checkIn` was true, the whole selection was discarded, and the guest
    // was told "Minimum stay is one night" with no check-out ever recorded. Those rules belong to
    // `endDate` alone.
    const isCheckoutCommit =
      selectionState === 'CHECK_IN_SELECTED' &&
      !!existingCheckIn &&
      !!startDate &&
      startDate.getTime() === existingCheckIn.getTime();

    // Reject clicks on unavailable dates - keep the visual disabled state and what actually
    // happens on click in step with each other.
    if (startDate && !isCheckoutCommit && isDayUnavailable(startDate)) {
      return; // Ignore selection - date is disabled (e.g. past date)
    }
    if (endDate && isDayUnavailable(endDate)) {
      return;
    }

    // 1-night minimum, judged against the candidate check-out. The grid already greys these days
    // out, so this is the backstop for a consumer that overrides `disabledDay` via dateRangeProps.
    if (isCheckoutCommit && endDate && isTooEarlyForCheckout(endDate)) {
      setValidationError('Minimum stay is one night. Select a check-out date after check-in.');
      return;
    }

    if (!startDate) {
      applySelection(startDate, endDate);
      return;
    }

    if (selectionState === 'IDLE') {
      if (applySelection(startDate, null)) {
        setSelectionState('CHECK_IN_SELECTED');
      }
      return;
    }

    if (selectionState === 'CHECK_IN_SELECTED') {
      if (!existingCheckIn) {
        if (applySelection(startDate, null)) {
          setSelectionState('CHECK_IN_SELECTED');
        }
        return;
      }

      // If we have a valid range (endDate provided and > startDate), complete it
      if (endDate && startDate && endDate > startDate) {
        if (applySelection(startDate, endDate)) {
          setSelectionState('RANGE_SELECTED');
        }
        return;
      }

      // User clicked a date before check-in - reset with new check-in
      if (startDate < existingCheckIn) {
        if (applySelection(startDate, null)) {
          setSelectionState('CHECK_IN_SELECTED');
        }
        return;
      }

      // User clicked same date or a date after check-in - treat as checkout
      const checkoutDate = endDate && endDate > existingCheckIn ? endDate : startDate;
      if (checkoutDate > existingCheckIn && applySelection(existingCheckIn, checkoutDate)) {
        setSelectionState('RANGE_SELECTED');
      }
      return;
    }

    // RANGE_SELECTED: start over with new check-in
    if (applySelection(startDate, null)) {
      setSelectionState('CHECK_IN_SELECTED');
    }
  };

  const normalizedStart =
    normalizeDate(value.startDate) ?? normalizeDate(minDate ?? null) ?? getIstCalendarDate();
  const normalizedEnd = normalizeDate(value.endDate) ?? normalizedStart;

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const handleClickOutside = (event: Event) => {
      const target = event.target as HTMLElement;
      
    // Ignore clicks on month/year dropdowns so the picker stays open
    if (target.closest('.rdrMonthPicker') || target.closest('.rdrYearPicker') || target.closest('.rdrMonthAndYearPickers') || (target.tagName === 'SELECT')) {
      return;
    }
    
      // If click is on anchor element, don't close
      if (anchorRef.current?.contains(target)) {
        return;
      }
      
      // If click is inside calendar popover, don't close (let react-date-range handle it)
      // Check both the popover ref and any element with the booking-calendar-popover class
      const popoverElement = popoverRef.current || document.querySelector('.booking-calendar-popover');
      if (popoverElement && (popoverElement.contains(target) || popoverElement === target)) {
        return; // Don't close for ANY clicks inside the popover
      }
      
      // Click is outside popover and anchor - close it
      onClose();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Use 'click' event with capture: true so we check BEFORE other handlers
    // This way we can detect clicks inside the popover and return early
    document.addEventListener('click', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [anchorRef, onClose, open, popoverRef]);

  // Sync shownDate prop only when calendar first opens (false -> true transition)
  const prevOpenRef = useRef(open);
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (!open || wasOpen) {
      return; // Closing or already was open - don't sync
    }
    // Calendar just opened (false -> true)
    const next = normalizeToStartOfMonth(shownDate ?? value.startDate ?? minDate ?? new Date());
    setInternalShownDate(next);
  }, [open, shownDate, value.startDate, minDate]);

  const handleShownDateChange = (date: Date) => {
    const normalized = normalizeToStartOfMonth(date);
    setInternalShownDate(normalized);
    if (onShownDateChange) {
      onShownDateChange(normalized);
    }
  };

  const statusConfig =
    selectionState === 'IDLE'
      ? {
          label: 'Step 1: Select your check-in date',
          bg: 'bg-[#fffaf5]',
          color: 'text-[#1a1a2e]',
          dot: 'bg-[#ffb347]',
        }
      : selectionState === 'CHECK_IN_SELECTED'
      ? {
          label: 'Step 2: Select your check-out date',
          bg: 'bg-[#ffe8d6]',
          color: 'text-[#1a1a2e]',
          dot: 'bg-[#c2410c]',
        }
      : {
          label: nights ? `Range selected: ${nights} night${nights === 1 ? '' : 's'}` : 'Range selected',
          bg: 'bg-[#ffe8d6]',
          color: 'text-[#c2410c]',
          dot: 'bg-[#c2410c]',
        };

  return (
    <DateRangePickerPopover
      anchorRef={anchorRef}
      calendarRef={popoverRef}
      contentId={contentId ?? fallbackContentId}
      instructionText={instructionText}
      instructionAriaLabel="Click to select check-in date, then choose from calendar"
      showInstruction={shouldShowInstruction}
      heading={heading}
      labelId={labelId ?? fallbackLabelId}
      loadingLabel={loadingLabel}
      onClose={onClose}
      open={open}
      popoverClassName={popoverClassName}
    >
      <div className={`mx-5 mt-4 mb-2 rounded-lg px-4 py-2 text-sm font-semibold ${statusConfig.bg} ${statusConfig.color}`} aria-live="polite">
        <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${statusConfig.dot}`} aria-hidden />
        {statusConfig.label}
      </div>
      {/* TASK-1712: Quick-preset pills */}
      <div className="mx-5 mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Quick date presets">
        {quickPresets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={preset.disabled}
            onClick={() => handlePresetClick(preset.start, preset.end)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors
              ${preset.disabled
                ? 'cursor-not-allowed text-[#d6c2a8] ring-1 ring-inset ring-[#f0e6dc]'
                : 'cursor-pointer bg-white text-[#475569] ring-1 ring-inset ring-[#f0e6dc] hover:bg-[#ffe8d6] hover:text-[#c2410c] hover:ring-[#c2410c] active:bg-[#ffe8d6]'
              }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {validationError && (
        <div className="mx-5 mt-4 mb-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700" role="alert">
          {validationError}
        </div>
      )}
      {loading ? (
        <div className="grid grid-cols-7 gap-2 p-3">
          {Array.from({ length: 14 }).map((_, index) => (
            <div
              key={index}
              className="h-10 rounded-lg bg-[#f0e6dc]"
            />
          ))}
        </div>
      ) : (
        <div className="relative">
          <DateRange
            key={`date-range-${internalShownDate.getFullYear()}-${internalShownDate.getMonth()}`}
            ranges={[
              {
                startDate: normalizedStart,
                endDate: normalizedEnd,
                key: 'selection',
              },
            ]}
            retainEndDateOnFirstSelection={true}
            dragSelectionEnabled={false}
            moveRangeOnFirstSelection={false}
            editableDateInputs={false}
            minDate={minDate}
            maxDate={maxDate}
            disabledDates={disabledDates}
            disabledDay={composedDisabledDay}
            months={months}
            direction="horizontal"
            showDateDisplay={false}
            showPreview={false}
            showSelectionPreview
            dayContentRenderer={dayContentRenderer}
            shownDate={normalizeToStartOfMonth(internalShownDate)}
            onShownDateChange={handleShownDateChange}
            rangeColors={rangeColors}
            {...dateRangeProps}
            onChange={handleRangeChange}
          />
          {afterCalendar}
        </div>
      )}
    </DateRangePickerPopover>
  );
};

export default AtlasDateRangePicker;
