import React, { useEffect, useId, useRef } from 'react';
import { addDays } from 'date-fns';
import { DateRange, type RangeKeyDict } from 'react-date-range';

import { DateRangePickerPopover } from '../homepage_components/hotelBooking_form/DateRangePickerPopover';

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
}) => {
  const fallbackLabelId = useId();
  const fallbackContentId = useId();
  const fallbackCalendarRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = calendarRef ?? fallbackCalendarRef;

  const handleRangeChange = (ranges: RangeKeyDict) => {
    const selection = ranges.selection ?? { startDate: null, endDate: null };
    onChange({
      startDate: selection.startDate,
      endDate: selection.endDate,
    });
  };

  const normalizedStart = value.startDate ?? minDate ?? new Date();
  const normalizedEnd = value.endDate ?? addDays(normalizedStart, 1);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [anchorRef, onClose, open, popoverRef]);

  const composedDisabledDay = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return disabledDay ? disabledDay(date) : false;
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
            shownDate={shownDate}
            onShownDateChange={onShownDateChange}
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
