import React, { useEffect, useId, useRef, useState } from 'react';
import { addDays } from 'date-fns';
import { DateRange, type RangeKeyDict } from 'react-date-range';

import { DateRangePickerPopover } from '../homepage_components/hotelBooking_form/DateRangePickerPopover';

// Helper to normalize date to start of month (avoids timezone issues with date-fns startOfMonth)
const normalizeToStartOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
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
  rangeColors,
  shownDate,
  value,
  activeField,
}) => {
  const fallbackLabelId = useId();
  const fallbackContentId = useId();
  const fallbackCalendarRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = calendarRef ?? fallbackCalendarRef;

  const [internalShownDate, setInternalShownDate] = useState<Date>(() => {
    const initial = shownDate ?? value.startDate ?? minDate ?? new Date();
    return normalizeToStartOfMonth(initial);
  });

  const handleRangeChange = (ranges: RangeKeyDict) => {
    const selection = ranges.selection ?? { startDate: null, endDate: null };
    const { startDate, endDate } = selection;
    
    // Determine current state
    const hasStart = value.startDate !== null;
    const hasEnd = value.endDate !== null && value.endDate.getTime() !== value.startDate?.getTime();
    const currentState = hasStart && hasEnd ? 'rangeSelected' : hasStart ? 'checkInSelected' : 'empty';
    
    // If user explicitly clicked check-in field and a range exists
    if (activeField === 'checkin' && currentState === 'rangeSelected' && startDate && value.endDate) {
      const clickedDate = startDate;
      const existingCheckOut = value.endDate;
      
      // If clicked date is before check-out, set as new check-in
      if (clickedDate < existingCheckOut) {
        onChange({
          startDate: clickedDate,
          endDate: existingCheckOut,
        });
        return;
      }
      
      // If clicked date is after or equal to check-out, reset range and set new check-in
      onChange({
        startDate: clickedDate,
        endDate: null,
      });
      return;
    }
    
    // If user explicitly clicked check-out field and a range exists
    if (activeField === 'checkout' && currentState === 'rangeSelected' && startDate && value.startDate) {
      const clickedDate = startDate;
      const existingCheckIn = value.startDate;
      
      // If clicked date is after check-in, set as new check-out
      if (clickedDate > existingCheckIn) {
        onChange({
          startDate: existingCheckIn,
          endDate: clickedDate,
        });
        return;
      }
      
      // If clicked date is before or equal to check-in, show validation error (handled by parent)
      // For now, just reset the range
      onChange({
        startDate: clickedDate,
        endDate: null,
      });
      return;
    }
    
    // If in rangeSelected state and user clicks a date (no explicit field tracking)
    if (currentState === 'rangeSelected' && startDate && value.startDate) {
      const clickedDate = startDate;
      const existingCheckIn = value.startDate;
      
      // If clicked date is after check-in, update checkout only
      if (clickedDate > existingCheckIn) {
        onChange({
          startDate: existingCheckIn,
          endDate: clickedDate,
        });
        return;
      }
      
      // If before check-in, clear and restart
      onChange({
        startDate: clickedDate,
        endDate: null,
      });
      return;
    }
    
    // Normal flow for empty or checkInSelected states
    onChange({
      startDate,
      endDate,
    });
  };

  const normalizedStart = value.startDate ?? minDate ?? new Date();
  const normalizedEnd = value.endDate ?? addDays(normalizedStart, 1);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const handleClickOutside = (event: Event) => {
      const target = event.target as HTMLElement;
      
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

  const composedDisabledDay = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return disabledDay ? disabledDay(date) : false;
  };


  const handleShownDateChange = (date: Date) => {
    const normalized = normalizeToStartOfMonth(date);
    setInternalShownDate(normalized);
    if (onShownDateChange) {
      onShownDateChange(normalized);
    }
  };

  return (
    <DateRangePickerPopover
      anchorRef={anchorRef}
      calendarRef={popoverRef}
      contentId={contentId ?? fallbackContentId}
      heading={heading}
      labelId={labelId ?? fallbackLabelId}
      loadingLabel={loadingLabel}
      onClose={onClose}
      open={open}
    >
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
            retainEndDateOnFirstSelection
            dragSelectionEnabled={false}
            moveRangeOnFirstSelection={false}
            editableDateInputs
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
