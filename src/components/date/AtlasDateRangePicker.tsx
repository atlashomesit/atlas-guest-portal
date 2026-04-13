import React, { useEffect, useId, useRef, useState } from 'react';
import { startOfDay } from 'date-fns';
import { DateRange, type RangeKeyDict } from 'react-date-range';

import { DateRangePickerPopover } from '../homepage_components/hotelBooking_form/DateRangePickerPopover';
import { getIstStartOfDay } from '@/utils/date';

// Helper to normalize date to start of month (avoids timezone issues with date-fns startOfMonth)
const normalizeToStartOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const normalizeDate = (date: Date | null): Date | null => {
  if (!date) return null;
  // Use IST normalization to match BookingCardCalendarSection and ensure consistent comparisons
  return getIstStartOfDay(date);
};

export interface AtlasDateRangePickerValue {
  startDate: Date | null;
  endDate: Date | null;
}

interface AtlasDateRangePickerProps {
  anchorRef: React.RefObject<HTMLElement>;
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
  calendarRef?: React.RefObject<HTMLDivElement>;
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

  const nights =
    value.startDate && value.endDate
      ? Math.max(
          1,
          Math.round((value.endDate.getTime() - value.startDate.getTime()) / (1000 * 60 * 60 * 24)),
        )
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
    const diffDays = Math.floor((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    if (checkOut <= checkIn) {
      return { valid: false, error: 'Check-out date must be after check-in date' };
    }
    if (diffDays < 1) {
      return { valid: false, error: 'Minimum stay is 1 night. Check-out must be at least 1 day after check-in' };
    }
    if (diffDays > 30) {
      return { valid: false, error: 'Maximum stay is 30 nights. For longer stays, please contact us at +91-7032493290' };
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

  const composedDisabledDay = (date: Date) => {
    const normalized = normalizeDate(date);
    const checkIn = normalizeDate(value.startDate);
    if (minDate && normalized && normalized < normalizeDate(minDate)!) return true;
    if (maxDate && normalized && normalized > normalizeDate(maxDate)!) return true;
    // When selecting checkout, disable same-day or earlier than check-in to enforce 1-night minimum
    if (selectionState === 'CHECK_IN_SELECTED' && checkIn && normalized && normalized <= checkIn) {
      return true;
    }
    return disabledDay ? disabledDay(date) : false;
  };

  const handleRangeChange = (ranges: RangeKeyDict) => {
    const selection = ranges.selection ?? { startDate: null, endDate: null };
    const startDate = normalizeDate(selection.startDate);
    const endDate = normalizeDate(selection.endDate);

    // Reject clicks on disabled dates - ensure visual disabled state matches functional behavior
    if (startDate && composedDisabledDay(startDate)) {
      if (selectionState === 'CHECK_IN_SELECTED') {
        const checkIn = normalizeDate(value.startDate);
        const normalized = normalizeDate(startDate);
        if (checkIn && normalized && normalized.getTime() <= checkIn.getTime()) {
          setValidationError('Minimum stay is one night. Select a check-out date after check-in.');
        }
      }
      return; // Ignore selection - date is disabled (e.g. past date)
    }
    if (endDate && composedDisabledDay(endDate)) {
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
      const existingCheckIn = normalizeDate(value.startDate);
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

  const normalizedStart = normalizeDate(value.startDate) ?? normalizeDate(minDate ?? null) ?? startOfDay(new Date());
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
          bg: 'bg-cyan-50',
          color: 'text-cyan-900',
          dot: 'bg-cyan-500',
        }
      : selectionState === 'CHECK_IN_SELECTED'
      ? {
          label: 'Step 2: Select your check-out date',
          bg: 'bg-emerald-50',
          color: 'text-emerald-900',
          dot: 'bg-emerald-500',
        }
      : {
          label: nights ? `Range selected: ${nights} night${nights === 1 ? '' : 's'}` : 'Range selected',
          bg: 'bg-slate-50',
          color: 'text-slate-900',
          dot: 'bg-slate-500',
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
              className="h-10 rounded-lg bg-[#F1F5F9] animate-pulse"
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
