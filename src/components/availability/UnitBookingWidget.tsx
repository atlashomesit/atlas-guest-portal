import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { AtlasDateRangePicker, type AtlasDateRangePickerValue } from '@/components/date/AtlasDateRangePicker';
import { useBooking } from '@/contexts/BookingContext';
import { logApiError, logUserAction } from '@/lib/monitoring';
import { getBookingsForListing } from '@/services/bookingService';
import { getIstStartOfDay } from '@/utils/date';
import { calculateNights, formatNightCount } from '@/utils/dateHelpers';
import { doesRangeIntersectBlocked, expandBookingsToBlockedSet, parseISODate, toISODate } from '@/utils/dateRange';
import { type BookingDTO } from '@/types/booking';

interface UnitBookingWidgetProps {
  listingId: string | number;
}

const normalizeListingId = (value: string | number | null | undefined) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const UnitBookingWidget: React.FC<UnitBookingWidgetProps> = ({ listingId }) => {
  if (import.meta.env.DEV) {
    console.assert(Boolean(listingId), '[UnitBookingWidget] listingId is required for unit mode');
  }

  const navigate = useNavigate();
  const location = useLocation();
  const { updateBooking } = useBooking();

  const today = getIstStartOfDay();
  const maxBookingDate = useMemo(() => addDays(today, 365), [today]);

  const calendarButtonRef = useRef<HTMLButtonElement | null>(null);

  const [dateRange, setDateRange] = useState<AtlasDateRangePickerValue>({
    startDate: today,
    endDate: addDays(today, 1),
  });
  const [openCalendar, setOpenCalendar] = useState(false);
  const [shownDate, setShownDate] = useState<Date>(today);
  const [guests, setGuests] = useState(2);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBookedDates = async () => {
      if (!listingId) {
        setBookedDates([]);
        setBlockedSet(new Set());
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const normalizedTarget = normalizeListingId(listingId);

      logUserAction('unit_booking_availability_fetch_start', {
        listingId: normalizedTarget,
        source: 'mock',
      });

      try {
        const bookings: BookingDTO[] = await getBookingsForListing(normalizedTarget);
        const blocked = expandBookingsToBlockedSet(bookings);
        const blockedDates = Array.from(blocked)
          .map((iso) => parseISODate(iso))
          .sort((a, b) => a.getTime() - b.getTime());

        setBlockedSet(blocked);
        setBookedDates(blockedDates);
        setStatusMessage('Some dates are unavailable due to existing bookings.');
      } catch (error) {
        setStatusMessage('We could not refresh availability. Try again in a moment.');
        setBookedDates([]);
        setBlockedSet(new Set());
        logApiError(error, {
          url: 'mock://bookings',
          method: 'GET',
          category: 'network',
          tags: { listingId: normalizedTarget },
        });
      } finally {
        setIsLoading(false);
        logUserAction('unit_booking_availability_fetch_end', { listingId: normalizedTarget });
      }
    };

    fetchBookedDates();
  }, [listingId]);

  const disabledDay = (date: Date) => {
    const normalized = getIstStartOfDay(date);
    if (normalized < today) return true;
    const iso = toISODate(normalized);
    return blockedSet.has(iso);
  };

  const handleRangeChange = (next: AtlasDateRangePickerValue) => {
    setDateError(null);
    const { startDate, endDate } = next;
    if (!startDate) {
      setDateRange(next);
      return;
    }

    const startISO = toISODate(startOfDay(startDate));
    if (blockedSet.has(startISO)) {
      setDateError('These dates overlap an existing booking. Please choose different dates.');
      setDateRange({ startDate: null, endDate: null });
      return;
    }

    if (endDate) {
      const endISO = toISODate(startOfDay(endDate));
      if (doesRangeIntersectBlocked(startISO, endISO, blockedSet)) {
        setDateError('These dates overlap an existing booking. Please choose different dates.');
        setDateRange({ startDate, endDate: null });
        return;
      }
    }

    setDateRange(next);
  };

  const formattedDateLabel = dateRange.startDate && dateRange.endDate
    ? `${format(dateRange.startDate, 'EEE, dd MMM')} – ${format(dateRange.endDate, 'EEE, dd MMM')}`
    : 'Add your travel dates';

  const handleSubmit = () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setFormError('Select your check-in and check-out dates.');
      return;
    }

    setFormError(null);
    updateBooking({
      propertyId: listingId,
      checkIn: dateRange.startDate.toISOString(),
      checkOut: dateRange.endDate.toISOString(),
      guests,
    });

    navigate('/reserve', { state: { from: location.pathname, listingId } });
  };

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-6 space-y-5">
      <div className="space-y-1">
        <p className="text-sm uppercase tracking-[0.12em] text-text-muted font-semibold">Reserve</p>
        <h3 className="text-xl sm:text-2xl font-semibold text-text-primary">Book this home</h3>
        <p className="text-text-secondary text-sm">Choose your dates to confirm availability for this apartment.</p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="unit-booking-dates">
            Dates
          </label>
          <p className="text-xs text-text-secondary">Some dates are unavailable due to existing bookings.</p>
          <button
            id="unit-booking-dates"
            ref={calendarButtonRef}
            className="w-full rounded-xl border border-border-strong bg-bg-muted px-4 py-3 text-left text-text-primary hover:border-cta-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
            onClick={() => {
              // Update shown date to the selected start date when opening calendar
              if (dateRange.startDate) {
                setShownDate(startOfDay(dateRange.startDate));
              }
              setOpenCalendar(true);
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm sm:text-base">{formattedDateLabel}</span>
              <span className="text-xs text-text-muted">{isLoading ? 'Loading…' : `${bookedDates.length} dates blocked`}</span>
            </div>
            {dateRange.startDate && dateRange.endDate && calculateNights(dateRange.startDate, dateRange.endDate) > 0 && (
              <div className="mt-2 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)] bg-[var(--bg-surface)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)]">
                  {formatNightCount(calculateNights(dateRange.startDate, dateRange.endDate))}
                </span>
              </div>
            )}
          </button>
          <div className="unit-datepicker-wrapper">
            <AtlasDateRangePicker
              anchorRef={calendarButtonRef}
              open={openCalendar}
              onClose={() => setOpenCalendar(false)}
              value={dateRange}
              onChange={handleRangeChange}
              loading={isLoading}
              minDate={today}
              maxDate={maxBookingDate}
              disabledDay={disabledDay}
              months={2}
              shownDate={shownDate}
              onShownDateChange={(date) => {
                console.log('🏘️ [UnitBookingWidget] Updating shownDate to:', date);
                setShownDate(startOfDay(date));
              }}
              loadingLabel="Loading availability"
              rangeColors={['#475569']}
              dayContentRenderer={(day) => {
                const dayStart = startOfDay(day);
                const selectionStart = dateRange.startDate ? startOfDay(dateRange.startDate).getTime() : null;
                const selectionEnd = dateRange.endDate ? startOfDay(dateRange.endDate).getTime() : null;
                const isRangeStart = selectionStart !== null && dayStart.getTime() === selectionStart;
                const isRangeEnd = selectionEnd !== null && dayStart.getTime() === selectionEnd;
                const rangeStart = selectionStart !== null && selectionEnd !== null ? Math.min(selectionStart, selectionEnd) : null;
                const rangeEnd = selectionStart !== null && selectionEnd !== null ? Math.max(selectionStart, selectionEnd) : null;
                const isInRange =
                  rangeStart !== null && rangeEnd !== null
                    ? dayStart.getTime() >= rangeStart && dayStart.getTime() <= rangeEnd
                    : false;
                const isDisabled = disabledDay(day);
                const isToday = dayStart.getTime() === today.getTime();

                return (
                  <div className="relative flex h-full w-full items-center justify-center">
                    {isInRange && !isRangeStart && !isRangeEnd && (
                      <span
                        className="absolute inset-0 bg-[var(--bg-primary)]"
                        aria-hidden
                      />
                    )}
                    <span
                      className={`relative z-10 flex items-center justify-center text-sm font-medium transition ${
                        isRangeStart || isRangeEnd
                          ? 'bg-[var(--cta-primary)] text-white rounded-xl px-3 py-2 shadow-sm'
                          : isDisabled
                          ? 'text-[var(--border-strong)] cursor-not-allowed opacity-50'
                          : 'text-[var(--brand)]'
                      }`}
                      style={{ minHeight: 38, minWidth: 38 }}
                    >
                      {format(day, 'd')}
                      {isToday && !isRangeStart && !isRangeEnd && (
                        <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-4 h-0.5 bg-[#94A3B8] rounded-full" />
                      )}
                    </span>
                  </div>
                );
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="unit-booking-guests">
            Guests
          </label>
          <div className="flex items-center gap-3 rounded-xl border border-border-strong bg-bg-muted px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="!px-2 !py-2 h-9 w-9"
                aria-label="Decrease guests"
                onClick={() => setGuests((current) => Math.max(1, current - 1))}
              >
                −
              </Button>
              <span className="text-base font-semibold text-text-primary" id="unit-booking-guests">
                {guests} {guests === 1 ? 'guest' : 'guests'}
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="!px-2 !py-2 h-9 w-9"
                aria-label="Increase guests"
                onClick={() => setGuests((current) => Math.min(16, current + 1))}
              >
                +
              </Button>
            </div>
          </div>
        </div>
      </div>

      {dateError && <p className="text-sm text-support-error">{dateError}</p>}
      {statusMessage && <p className="text-sm text-text-secondary">{statusMessage}</p>}
      {formError && <p className="text-sm text-support-error">{formError}</p>}

      <Button fullWidth onClick={handleSubmit} disabled={isLoading}>
        Book this home
      </Button>
    </div>
  );
};

export default UnitBookingWidget;

