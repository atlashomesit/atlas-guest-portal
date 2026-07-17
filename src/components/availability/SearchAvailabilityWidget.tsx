import React from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { addDays, format, startOfDay, startOfMonth } from 'date-fns';
import { CalendarRange, ChevronDown } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';
import { useBooking } from '../../contexts/BookingContext';
import { AtlasDateRangePicker, type AtlasDateRangePickerValue } from '../date/AtlasDateRangePicker';
import { calculateNights, formatNightCount } from '../../utils/dateHelpers';
import { GuestTypeSelector, type GuestCounts } from '../ui/GuestTypeSelector';

type AvailabilityMode = 'search' | 'listing';

const MIN_GUESTS = 1;
const MAX_GUESTS = 20;

interface SearchAvailabilityWidgetProps {
  mode?: AvailabilityMode;
  listingId?: string | number | null;
}

export const SearchAvailabilityWidget: React.FC<SearchAvailabilityWidgetProps> = ({
  mode = 'search',
  listingId,
}) => {
  if (mode === 'search' && listingId) {
    throw new Error('SearchAvailabilityWidget does not accept listingId in search mode');
  }

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const defaultRange = React.useMemo(
    () => ({
      startDate: today,
      endDate: addDays(today, 1),
    }),
    [today],
  );

  const [dateRange, setDateRange] = React.useState<{ startDate: Date | null; endDate: Date | null }>(
    defaultRange,
  );
  const [guestCounts, setGuestCounts] = React.useState<GuestCounts>({
    adults: 2,
    children: 0,
    infants: 0,
    pets: 0,
  });
  const [dateError, setDateError] = React.useState<string | null>(null);
  const [guestError, setGuestError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [isGuestsOpen, setIsGuestsOpen] = React.useState(false);
  const [activeField, setActiveField] = React.useState<'checkin' | 'checkout' | null>(null);
  const [isSubmitting, _setIsSubmitting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string>('');
  const [hasInteracted, setHasInteracted] = React.useState(false);
  // P0 fix (5th-pass): modal state removed — Check availability navigates directly to /search
  // Initialize calendar as ready - no async data needed, calendar renders client-side
  const [calendarReady] = React.useState(true);
  const [shownDate, setShownDate] = React.useState<Date>(() => defaultRange.startDate ?? today);
  const hasTrackedDropoff = React.useRef(false);
  const hasInteractedRef = React.useRef(false);
  const latestWidgetStateRef = React.useRef({ hasSelection: false, guests: 2, guestCounts });
  const calendarWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const toggleButtonRef = React.useRef<HTMLButtonElement | null>(null);
  // TASK-4911: separate ref for the check-out toggle so an incomplete-date submit can focus
  // whichever field is actually missing, instead of only ever focusing check-in.
  const checkoutToggleButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const lastFocusedTriggerRef = React.useRef<HTMLElement | null>(null);
  const hasHydratedRef = React.useRef(false);
  const calendarContentId = React.useId();
  const calendarLabelId = React.useId();
  const dateErrorId = React.useId();
  const { booking, updateBooking } = useBooking();
  const monthsToShow = React.useMemo(
    () => (typeof window !== 'undefined' && window.innerWidth < 768 ? 1 : 2),
    [],
  );

  const parseDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = startOfDay(new Date(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const clampRange = (startDate: Date | null, endDate: Date | null) => {
    const normalizedStart = startDate && startDate < today ? today : startDate;
    let normalizedEnd = endDate ?? null;
    let errorMessage: string | null = startDate && startDate < today ? 'Check-in cannot be in the past.' : null;

    if (normalizedStart && normalizedEnd && normalizedEnd <= normalizedStart) {
      normalizedEnd = null;
      errorMessage = 'Minimum stay is 1 night after check-in.';
    }

    return { startDate: normalizedStart ?? null, endDate: normalizedEnd, error: errorMessage };
  };

  const validateGuests = (value: number) => {
    if (value < MIN_GUESTS) {
      return 'Guests must be at least 1.';
    }

    if (value > MAX_GUESTS) {
      return `Guests cannot exceed ${MAX_GUESTS}.`;
    }

    return null;
  };

  const hydrateFromContext = React.useCallback(
    () => ({
      startDate: parseDate(booking.checkIn),
      endDate: parseDate(booking.checkOut),
      guests: booking.guests > 0 ? booking.guests : null,
      adults: booking.adults ?? null,
      children: booking.children ?? null,
      infants: booking.infants ?? null,
      pets: booking.pets ?? null,
      propertyId: booking.propertyId ?? null,
    }),
    [booking.checkIn, booking.checkOut, booking.guests, booking.adults, booking.children, booking.infants, booking.pets, booking.propertyId],
  );

  const bookingPrefill = React.useMemo(() => {
    const state = location.state as
      | {
          bookingPrefill?: {
            propertyId?: string | number | null;
            checkIn?: string | null;
            checkOut?: string | null;
            guests?: number | null;
            // TASK-3938: guest-count breakdown forwarded by callers (e.g. Navbar Book-Now CTA)
            // so the widget preserves it instead of re-deriving a split from the total.
            adults?: number | null;
            children?: number | null;
            infants?: number | null;
            pets?: number | null;
          };
        }
      | null;

    return state?.bookingPrefill ?? null;
  }, [location.state]);

  React.useEffect(() => {
    if (hasHydratedRef.current) return;
    const stored = hydrateFromContext();
    const paramRange = {
      startDate: parseDate(searchParams.get('checkIn')),
      endDate: parseDate(searchParams.get('checkOut')),
      guests: Number(searchParams.get('guests')) || null,
      adults: Number(searchParams.get('adults')) || null,
      children: Number(searchParams.get('children')) || null,
      infants: Number(searchParams.get('infants')) || null,
      pets: Number(searchParams.get('pets')) || null,
    };

    const stateRange = bookingPrefill
      ? {
          startDate: parseDate(bookingPrefill.checkIn),
          endDate: parseDate(bookingPrefill.checkOut),
          guests: bookingPrefill.guests && bookingPrefill.guests > 0 ? bookingPrefill.guests : null,
          adults: bookingPrefill.adults ?? null,
          children: bookingPrefill.children ?? null,
          infants: bookingPrefill.infants ?? null,
          pets: bookingPrefill.pets ?? null,
          propertyId: bookingPrefill.propertyId ?? null,
        }
      : null;

    const startDate = stateRange?.startDate ?? paramRange.startDate ?? stored?.startDate ?? defaultRange.startDate;
    const endDate = stateRange?.endDate ?? paramRange.endDate ?? stored?.endDate ?? defaultRange.endDate;

    const nextRange = clampRange(startDate, endDate);
    const nextGuests =
      (stateRange?.guests && stateRange.guests > 0
        ? stateRange.guests
        : null) || (paramRange.guests && paramRange.guests > 0 ? paramRange.guests : stored?.guests ?? 2);
    const nextPropertyId = stateRange?.propertyId ?? stored?.propertyId ?? null;
    
    // Initialize guest counts from params or stored values
    const nextGuestCounts: GuestCounts = {
      adults: (stateRange?.adults ?? paramRange.adults ?? stored?.adults) || Math.max(1, Math.floor(nextGuests * 0.6)),
      children: (stateRange?.children ?? paramRange.children ?? stored?.children) || Math.max(0, Math.floor(nextGuests * 0.4)),
      infants: (stateRange?.infants ?? paramRange.infants ?? stored?.infants) || 0,
      pets: (stateRange?.pets ?? paramRange.pets ?? stored?.pets) || 0,
    };
    
    const totalGuests = nextGuestCounts.adults + nextGuestCounts.children;

    setDateRange({ startDate: nextRange.startDate, endDate: nextRange.endDate });
    setDateError(null);
    setGuestError(validateGuests(totalGuests));
    setGuestCounts(nextGuestCounts);
    setShownDate(nextRange.startDate ?? today);
    updateBooking({
      checkIn: nextRange.startDate?.toISOString() ?? null,
      checkOut: nextRange.endDate?.toISOString() ?? null,
      guests: totalGuests,
      adults: nextGuestCounts.adults,
      children: nextGuestCounts.children,
      infants: nextGuestCounts.infants,
      pets: nextGuestCounts.pets,
      propertyId: nextPropertyId,
    });
    hasHydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clampRange/today stable for hydration; adding would re-run every render
  }, [
    bookingPrefill,
    defaultRange.endDate,
    defaultRange.startDate,
    hydrateFromContext,
    searchParams,
    updateBooking,
  ]);

  React.useEffect(() => {
    if (!isCalendarOpen || typeof window === 'undefined') return;

    const shouldLockBody = typeof window !== 'undefined' && window.innerWidth < 768;
    const previousOverflow = document.body.style.overflow;

    if (shouldLockBody) {
      document.body.style.overflow = 'hidden';
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is inside the calendar popover (rendered via portal)
      const popoverElement = document.querySelector('.booking-calendar-popover');
      const isInsidePopover = popoverElement && (popoverElement.contains(target) || popoverElement === target);
      
      if (
        calendarWrapperRef.current &&
        !calendarWrapperRef.current.contains(target) &&
        toggleButtonRef.current &&
        !toggleButtonRef.current.contains(target) &&
        !isInsidePopover
      ) {
        setIsCalendarOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCalendarOpen(false);
      }
    };

    // Use 'click' event (bubble phase) - AtlasDateRangePicker uses capture phase
    // This ensures we check after AtlasDateRangePicker's handler
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      if (shouldLockBody) {
        document.body.style.overflow = previousOverflow;
      }
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isCalendarOpen]);

  // Calendar is always ready - no async loading needed since dates are generated client-side
  // Keeping this useEffect commented out for reference, but calendarReady starts as true
  // React.useEffect(() => {
  //   // Calendar component renders immediately, no loading state needed
  // }, [isCalendarOpen]);

  React.useEffect(() => {
    hasInteractedRef.current = hasInteracted;
  }, [hasInteracted]);

  const toggleCalendar = (field: 'checkin' | 'checkout' = 'checkin') => {
    lastFocusedTriggerRef.current = document.activeElement as HTMLElement | null;
    setActiveField(field);
    setIsCalendarOpen((open) => !open);
  };

  const wasOpenRef = React.useRef(isCalendarOpen);
  React.useEffect(() => {
    if (wasOpenRef.current && !isCalendarOpen && lastFocusedTriggerRef.current) {
      lastFocusedTriggerRef.current.focus();
    }

    wasOpenRef.current = isCalendarOpen;
  }, [isCalendarOpen]);

  React.useEffect(() => {
    const totalGuests = guestCounts.adults + guestCounts.children;
    latestWidgetStateRef.current = {
      hasSelection: Boolean(dateRange.startDate && dateRange.endDate),
      guests: totalGuests,
      guestCounts,
    };
  }, [dateRange.endDate, dateRange.startDate, guestCounts]);

  React.useEffect(() => {
    const totalGuests = guestCounts.adults + guestCounts.children;
    updateBooking({
      checkIn: dateRange.startDate?.toISOString() ?? null,
      checkOut: dateRange.endDate?.toISOString() ?? null,
      guests: totalGuests,
      adults: guestCounts.adults,
      children: guestCounts.children,
      infants: guestCounts.infants,
      pets: guestCounts.pets,
    });
  }, [dateRange.endDate, dateRange.startDate, guestCounts, updateBooking]);

  React.useEffect(() => {
    if (dateRange.startDate) {
      setShownDate(dateRange.startDate);
    }
  }, [dateRange.startDate]);

  React.useEffect(
    () => () => {
      if (hasInteractedRef.current && !hasTrackedDropoff.current) {
        hasTrackedDropoff.current = true;
        trackEvent('hero_widget_dropoff', {
          surface: 'hero_form',
          hasDates: latestWidgetStateRef.current.hasSelection,
          guests: latestWidgetStateRef.current.guests,
        });
      }
    },
    [],
  );

  const handleValidation = () => {
    const { startDate, endDate, error: rangeError } = clampRange(dateRange.startDate, dateRange.endDate);
    setDateRange({ startDate, endDate });
    setDateError(rangeError);

    if (!startDate || !endDate) {
      // TASK-4911: distinguish which field is actually missing so the guest doesn't have to
      // guess, and move focus there — mirrors the UnitBookingWidget Reserve CTA pattern
      // (TASK-4277) instead of silently no-op'ing on a disabled button.
      const message = !startDate
        ? 'Add a check-in date to continue.'
        : 'Add a check-out date to continue.';
      setError(message);
      setDateError(message);
      setStatusMessage(message);
      if (!startDate) {
        toggleButtonRef.current?.focus();
      } else {
        checkoutToggleButtonRef.current?.focus();
      }
      return { isValid: false };
    }

    if (rangeError) {
      setError(rangeError);
      setStatusMessage(rangeError);
    } else {
      setError(null);
    }

    const totalGuests = guestCounts.adults + guestCounts.children;
    const guestValidation = validateGuests(totalGuests);
    setGuestError(guestValidation);
    if (guestValidation) {
      setError(guestValidation);
      setStatusMessage(guestValidation);
      return { isValid: false };
    }

    const formattedCheckIn = format(startDate, 'yyyy-MM-dd');
    const formattedCheckOut = format(endDate, 'yyyy-MM-dd');

    const params = new URLSearchParams({
      checkIn: formattedCheckIn,
      checkOut: formattedCheckOut,
      guests: totalGuests.toString(),
      adults: guestCounts.adults.toString(),
      children: guestCounts.children.toString(),
      infants: guestCounts.infants.toString(),
      pets: guestCounts.pets.toString(),
    });

    return { isValid: true, searchParams: params, startDate, endDate };
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setStatusMessage('');
    markHeroInteraction();

    const validation = handleValidation();
    if (!validation.isValid || !validation.searchParams || !validation.startDate || !validation.endDate) return;

    trackEvent(
      'availability_search',
      {
        surface: 'hero_form',
        checkIn: validation.startDate.toISOString(),
        checkOut: validation.endDate.toISOString(),
        guests: guestCounts.adults + guestCounts.children,
        adults: guestCounts.adults,
        children: guestCounts.children,
        infants: guestCounts.infants,
        pets: guestCounts.pets,
      },
      { route: `/search?${validation.searchParams.toString()}` },
    );

    trackEvent(
      'listings_browse',
      {
        surface: 'hero_form',
        checkIn: validation.startDate.toISOString(),
        checkOut: validation.endDate.toISOString(),
        guests: guestCounts.adults + guestCounts.children + guestCounts.infants,
      },
      { route: `/search?${validation.searchParams.toString()}` },
    );

    // P0 fix (5th-pass): navigate directly to /search — no split-stays modal
    navigate({ pathname: '/search', search: validation.searchParams.toString() });
  };

  const handleRangeChange = (selection: AtlasDateRangePickerValue) => {
    const normalizedStart = selection.startDate ? startOfDay(selection.startDate) : null;
    const normalizedEnd = selection.endDate ? startOfDay(selection.endDate) : null;
    markHeroInteraction();

    const attemptedStart = normalizedStart ?? dateRange.startDate;
    const attemptedEnd = normalizedEnd ?? dateRange.endDate;
    const hasPastAttempt =
      (attemptedStart && attemptedStart < today) ||
      (attemptedEnd && attemptedEnd < today);

    if (hasPastAttempt) {
      const errorMessage = 'Check-in cannot be in the past.';
      setStatusMessage(errorMessage);
      setDateError(errorMessage);
      setError(errorMessage);
      return;
    }

    const nextRange = clampRange(normalizedStart, normalizedEnd);
    setStatusMessage(nextRange.error ?? 'Updated dates.');
    setDateError(nextRange.error);
    setDateRange({ startDate: nextRange.startDate, endDate: nextRange.endDate });
    setError(nextRange.error);

    trackEvent('hero_dates_changed', {
      surface: 'hero_form',
      checkIn: normalizedStart?.toISOString(),
      checkOut: normalizedEnd?.toISOString(),
    });
    if (selection.startDate && selection.endDate && normalizedEnd && normalizedStart && normalizedEnd > normalizedStart) {
      setIsCalendarOpen(false);
    }
  };


  const clearDates = () => {
    markHeroInteraction();
    setDateRange(defaultRange);
    setDateError(null);
    setError(null);
    setStatusMessage('');
    setIsCalendarOpen(false);
    setActiveField(null);
    setShownDate(defaultRange.startDate ?? today);
  };

  const hasCustomDates =
    dateRange.startDate?.getTime() !== defaultRange.startDate?.getTime() ||
    dateRange.endDate?.getTime() !== defaultRange.endDate?.getTime();

  const checkInLabel = dateRange.startDate ? format(dateRange.startDate, 'dd MMM yyyy') : 'Check-in';
  const checkOutLabel = dateRange.endDate ? format(dateRange.endDate, 'dd MMM yyyy') : 'Check-out';
  // TASK-4911: do NOT disable on incomplete/missing dates — keep "Check availability" clickable
  // so handleSubmit -> handleValidation can surface the inline "Add a check-out date to
  // continue." message and focus the missing field, instead of the button silently swallowing
  // the click (mirrors the UnitBookingWidget Reserve CTA fix, TASK-4277). Only genuine hard
  // blockers (a real date-order conflict with both dates present, or an invalid guest count)
  // still disable it.
  const isSubmitDisabled =
    isSubmitting ||
    guestCounts.adults < 1 ||
    Boolean(guestError) ||
    Boolean(dateRange.startDate && dateRange.endDate && dateRange.endDate <= dateRange.startDate);


  const markHeroInteraction = () => {
    if (!hasInteractedRef.current) {
      hasInteractedRef.current = true;
    }
    setHasInteracted(true);
  };

  const formContainerClass =
    'hero-form w-full rounded-2xl bg-[var(--bg-surface)] shadow-[var(--shadow-level-2)] border border-[var(--border-subtle)] p-4 flex flex-col gap-3';

  // Equal columns so Check-in / Check-out / Guests / CTA values align on one baseline
  const formGridClass =
    'hero-form-grid grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-fr';

  const fieldShellClass =
    'field-card flex h-full min-h-[112px] flex-col justify-start gap-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-level-1)] hover:shadow-[var(--shadow-level-2)]';
  const dateFieldShellClass = `${fieldShellClass}${
    dateError ? ' border-[var(--support-error)] shadow-[0_0_0_1px_var(--support-error)] error-shake' : ''
  }`;
  const labelClass = 'hf-field-label';
  const valueClass =
    'date-value flex items-center justify-between gap-2 font-medium text-[var(--text-primary)]';
  return (
    <form onSubmit={handleSubmit} className={formContainerClass} data-testid="search-input" id="search-form">
      <div className="sr-only" role="status" aria-live="polite">
        {statusMessage || error || 'Hero form ready.'}
      </div>
      <div className={formGridClass} ref={calendarWrapperRef}>
        <div className="relative min-w-0">
          <button
            type="button"
            className={`${dateFieldShellClass} w-full text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary${activeField === 'checkin' && isCalendarOpen ? ' ring-2 ring-[var(--cta-primary)] ring-offset-2' : ''}`}
            aria-label="Click to select check-in date, then choose from calendar"
            title="Click to select check-in date, then choose from calendar"
            aria-expanded={isCalendarOpen}
            aria-describedby={dateError ? dateErrorId : undefined}
            aria-invalid={dateError ? true : undefined}
            onClick={() => toggleCalendar('checkin')}
            data-testid="hero-date-toggle"
            ref={toggleButtonRef}
            aria-controls={calendarContentId}
          >
            <span className={labelClass}>
              <CalendarRange className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
              <span>Check-in</span>
            </span>
            <span className={valueClass}>
              <span className="hf-value-text">{checkInLabel}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${isCalendarOpen ? 'rotate-180' : ''}`} aria-hidden />
            </span>
            {dateError && (
              <span className="text-sm font-semibold text-support-error" id={dateErrorId} role="alert">
                {dateError}
              </span>
            )}
          </button>
        </div>

        <div className="relative min-w-0">
        <button
          type="button"
          className={`${dateFieldShellClass} w-full text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary${activeField === 'checkout' && isCalendarOpen ? ' ring-2 ring-[var(--cta-primary)] ring-offset-2' : ''}`}
          aria-label="Click to select check-out date, then choose from calendar"
          title="Click to select check-out date, then choose from calendar"
          aria-expanded={isCalendarOpen}
          aria-describedby={dateError ? dateErrorId : undefined}
          aria-invalid={dateError ? true : undefined}
          onClick={() => toggleCalendar('checkout')}
          data-testid="hero-date-toggle-checkout"
          ref={checkoutToggleButtonRef}
          aria-controls={calendarContentId}
        >
          <span className={labelClass}>
            <CalendarRange className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            <span>Check-out</span>
          </span>
          <span className={valueClass}>
            <span className="hf-value-text">{checkOutLabel}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${isCalendarOpen ? 'rotate-180' : ''}`} aria-hidden />
          </span>
          {dateRange.startDate && dateRange.endDate && calculateNights(dateRange.startDate, dateRange.endDate) > 0 && (
            <span className="hf-night-chip inline-flex items-center text-xs font-semibold text-[var(--accent-primary)] bg-[var(--bg-muted)] px-2.5 py-1 rounded-full">
              {formatNightCount(calculateNights(dateRange.startDate, dateRange.endDate))}
            </span>
          )}
        </button>
        </div>

        <AtlasDateRangePicker
          anchorRef={calendarWrapperRef}
          contentId={calendarContentId}
          labelId={calendarLabelId}
          heading="Choose your stay dates"
          loadingLabel="Loading calendar…"
          open={isCalendarOpen}
          onClose={() => {
            setIsCalendarOpen(false);
            setActiveField(null);
          }}
          value={dateRange}
          onChange={handleRangeChange}
          minDate={today}
          disabledDay={(date) => startOfDay(date) < today}
          months={monthsToShow}
          shownDate={shownDate}
          onShownDateChange={(date) => {
            setShownDate(startOfMonth(date));
          }}
          rangeColors={[dateError ? 'var(--support-error)' : 'var(--cta-primary)']}
          loading={!calendarReady}
          activeField={activeField}
          dayContentRenderer={(day) => {
            const dayStart = startOfDay(day);
            const selectionStart = dateRange.startDate ? startOfDay(dateRange.startDate).getTime() : null;
            const selectionEnd = dateRange.endDate ? startOfDay(dateRange.endDate).getTime() : null;
            const isRangeStart = selectionStart !== null && dayStart.getTime() === selectionStart;
            const isRangeEnd = selectionEnd !== null && dayStart.getTime() === selectionEnd;
            const isDisabled = dayStart < today;

         return (
  <div className="relative flex h-full w-full items-center justify-center">
    <span
      data-testid={`hero-date-${format(day, 'yyyy-MM-dd')}`}
      className={`relative z-10 flex items-center justify-center text-sm font-medium transition ${
        isRangeStart || isRangeEnd
          ? 'bg-[var(--cta-primary)] text-white rounded-xl px-3 py-3 shadow-sm'
          : isDisabled
          ? 'text-[var(--border-strong)] cursor-not-allowed opacity-50'
          : 'text-[var(--brand)]'
      }`}
      style={{ minHeight: 40, minWidth: 40 }}
    >
      {format(day, 'd')}
    </span>
  </div>
);


          }}
        />

        <GuestTypeSelector
          value={guestCounts}
          onChange={(counts) => {
            markHeroInteraction();
            setGuestCounts(counts);
            const totalGuests = counts.adults + counts.children;
            setGuestError(validateGuests(totalGuests));
            trackEvent('hero_guests_changed', { 
              surface: 'hero_form', 
              adults: counts.adults,
              children: counts.children,
              infants: counts.infants,
              pets: counts.pets,
              totalGuests 
            });
          }}
          maxCapacity={MAX_GUESTS}
          isOpen={isGuestsOpen}
          onToggle={() => {
            markHeroInteraction();
            setIsGuestsOpen(!isGuestsOpen);
          }}
          onClose={() => setIsGuestsOpen(false)}
        />

        <div className={`${fieldShellClass} hf-cta-card min-w-0`}>
          <button
            type="submit"
            disabled={isSubmitDisabled || isSubmitting}
            data-testid="hero-search-submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--cta-primary)] px-4 text-sm font-semibold tracking-[0.01em] text-white shadow-[var(--shadow-level-2)] transition-colors hover:bg-[var(--cta-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cta-primary)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none aria-busy:cursor-progress aria-busy:opacity-90 whitespace-nowrap"
            onClick={() => setStatusMessage('Checking availability...')}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Checking...' : 'Check availability'}
          </button>
          <button
            type="button"
            data-testid="hero-browse-all"
            onClick={() => navigate('/search')}
            className="text-sm text-center text-[color:var(--text-muted)] underline underline-offset-2 hover:text-[color:var(--text-primary)] transition-colors w-full"
          >
            Browse all homes
          </button>
        </div>
      </div>

      {error && (
        <p className="text-left text-sm font-semibold text-[color-mix(in_srgb,var(--cta-secondary)_90%,transparent)]">
          {error}
        </p>
      )}
      {!error && statusMessage && (
        <p className="text-left text-sm font-semibold text-text-primary" aria-live="polite">
          {statusMessage}
        </p>
      )}

      {hasCustomDates && (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={clearDates}
            className="min-h-11 rounded-xl border border-border-subtle bg-bg-surface px-4 py-3 text-sm font-semibold text-text-primary hover:bg-bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
            data-testid="hero-search-clear-dates"
          >
            Clear
          </button>
        </div>
      )}

    </form>
  );
};

export default SearchAvailabilityWidget;
