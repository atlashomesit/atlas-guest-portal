import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';

import { API_BASE_URL, IS_API_BASE_CONFIGURED } from '@/config/api';
import { Button } from '@/components/ui/Button';
import { AtlasDateRangePicker, type AtlasDateRangePickerValue } from '@/components/date/AtlasDateRangePicker';
import { asArray, api } from '@/lib/api';
import { useBooking } from '@/contexts/BookingContext';
import { getIstStartOfDay } from '@/utils/date';
import { logApiError, logUserAction } from '@/lib/monitoring';

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
  const [guests, setGuests] = useState(2);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBookedDates = async () => {
      if (!listingId) {
        setBookedDates([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const requestUrl = `${API_BASE_URL ?? ''}/bookings`;
      const envMode = (import.meta as any)?.env?.MODE ?? 'unknown';
      const normalizedTarget = normalizeListingId(listingId);

      logUserAction('unit_booking_availability_fetch_start', {
        requestUrl,
        envMode,
        listingId: normalizedTarget,
        apiConfigured: IS_API_BASE_CONFIGURED,
      });

      try {
        if (!IS_API_BASE_CONFIGURED) {
          setStatusMessage('Showing demo availability. Configure the API base URL to see live bookings.');
          setBookedDates([]);
          return;
        }

        const response = await api.get('/bookings');
        const bookings = asArray(response.data, 'bookings');

        const targetNumber = normalizedTarget.match(/(\d+)/)?.[1];
        const matchedBookings = bookings.filter((booking: any) => {
          const normalizedListing = normalizeListingId(booking?.listing ?? booking?.listingId ?? booking?.propertyId);
          const bookingNumber = normalizedListing.match(/(\d+)/)?.[1];

          return normalizedListing === normalizedTarget || (!!targetNumber && bookingNumber === targetNumber);
        });

        const todayStart = getIstStartOfDay();
        const blockedDates: Date[] = [];

        matchedBookings.forEach((booking: any) => {
          const checkinDate = getIstStartOfDay(new Date(booking.checkinDate));
          const checkoutDate = getIstStartOfDay(new Date(booking.checkoutDate));

          if (Number.isNaN(checkinDate.getTime()) || Number.isNaN(checkoutDate.getTime())) return;

          let cursor = new Date(checkinDate);
          while (cursor < checkoutDate) {
            const day = getIstStartOfDay(cursor);
            if (day >= todayStart) {
              blockedDates.push(day);
            }
            cursor = addDays(cursor, 1);
          }
        });

        const uniqueBlockedDates = Array.from(new Set(blockedDates.map((date) => date.getTime())))
          .map((time) => new Date(time))
          .sort((a, b) => a.getTime() - b.getTime());

        setBookedDates(uniqueBlockedDates);
        setStatusMessage('Availability refreshed for this home.');
      } catch (error) {
        setStatusMessage('We could not refresh availability. Try again in a moment.');
        setBookedDates([]);
        logApiError(error, {
          url: requestUrl,
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

    return bookedDates.some((booked) => getIstStartOfDay(booked).getTime() === normalized.getTime());
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
          <button
            id="unit-booking-dates"
            ref={calendarButtonRef}
            className="w-full rounded-xl border border-border-strong bg-bg-muted px-4 py-3 text-left text-text-primary hover:border-cta-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
            onClick={() => setOpenCalendar(true)}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm sm:text-base">{formattedDateLabel}</span>
              <span className="text-xs text-text-muted">{isLoading ? 'Loading…' : `${bookedDates.length} dates blocked`}</span>
            </div>
          </button>
          <div className="unit-datepicker-wrapper">
            <AtlasDateRangePicker
              anchorRef={calendarButtonRef}
              open={openCalendar}
              onClose={() => setOpenCalendar(false)}
              value={dateRange}
              onChange={(next) => setDateRange(next)}
              loading={isLoading}
              minDate={today}
              maxDate={maxBookingDate}
              disabledDay={disabledDay}
              months={2}
              shownDate={dateRange.startDate ?? today}
              onShownDateChange={() => {}}
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

      {statusMessage && <p className="text-sm text-text-secondary">{statusMessage}</p>}
      {formError && <p className="text-sm text-support-error">{formError}</p>}

      <Button fullWidth onClick={handleSubmit} disabled={isLoading}>
        Book this home
      </Button>
    </div>
  );
};

export default UnitBookingWidget;

