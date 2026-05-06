import React from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { addDays, format, startOfDay, startOfMonth } from 'date-fns';
import { CalendarRange, ChevronDown, ShieldCheck } from 'lucide-react';
import { heroWidgetLayoutFlag } from '../../config/abFlags';
import { getApiBaseUrl } from '../../runtime-config';
import { getApiHeaders } from '../../api/client';
import { messageFromApiResponse } from '../../utils/serverErrorFromResponse';
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
  const enableWidgetExperiment = heroWidgetLayoutFlag();
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
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string>('');
  const [hasInteracted, setHasInteracted] = React.useState(false);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = React.useState(false);
  const [pendingSearchParams, setPendingSearchParams] = React.useState<URLSearchParams | null>(null);
  // Initialize calendar as ready - no async data needed, calendar renders client-side
  const [calendarReady] = React.useState(true);
  const [shownDate, setShownDate] = React.useState<Date>(() => defaultRange.startDate ?? today);
  const hasTrackedDropoff = React.useRef(false);
  const hasInteractedRef = React.useRef(false);
  const latestWidgetStateRef = React.useRef({ hasSelection: false, guests: 2, guestCounts });
  const calendarWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const toggleButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const lastFocusedTriggerRef = React.useRef<HTMLElement | null>(null);
  const hasHydratedRef = React.useRef(false);
  const calendarContentId = React.useId();
  const calendarLabelId = React.useId();
  const dateErrorId = React.useId();
  /* eslint-disable @typescript-eslint/no-unused-vars -- reserved for GuestTypeSelector a11y */
  const guestsLabelId = React.useId();
  const guestsHelperId = React.useId();
  const guestsErrorId = React.useId();
  /* eslint-enable @typescript-eslint/no-unused-vars */
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
      const message = 'Please select your check-in and check-out dates.';
      setError(message);
      setStatusMessage('Select both check-in and check-out dates to continue.');
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

    setPendingSearchParams(validation.searchParams);
    setIsAvailabilityModalOpen(true);
  };

  const performAvailabilityCheck = async (params: URLSearchParams) => {
    if (isSubmitting) return;
    const formattedCheckIn = params.get('checkIn');
    const formattedCheckOut = params.get('checkOut');

    if (!formattedCheckIn || !formattedCheckOut) return;

    const listingSearchRoute = `/search?${params.toString()}`;
    let availabilityUrl: string;
    let controller: AbortController | null;
    let timeoutId: number | null;
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    try {
      // GET /availability requires propertyId (contract); hero has no listing selected, so skip API call and just navigate to search
      const apiBaseUrl = getApiBaseUrl();
      const totalGuests = guestCounts.adults + guestCounts.children;
      const hasPropertyId = false; // Hero form does not select a property
      availabilityUrl =
        apiBaseUrl && hasPropertyId
          ? `${apiBaseUrl}/availability?propertyId=${0}&checkIn=${formattedCheckIn}&checkOut=${formattedCheckOut}&guests=${totalGuests}&adults=${guestCounts.adults}&children=${guestCounts.children}&infants=${guestCounts.infants}&pets=${guestCounts.pets}`
          : '';
      controller = availabilityUrl && typeof AbortController !== 'undefined' ? new AbortController() : null;
      timeoutId = controller ? window.setTimeout(() => controller.abort(), 10_000) : null;
    } catch (configError) {
      console.error('Hero availability configuration error:', configError);
      trackEvent(
        'availability_search_config_error',
        {
          surface: 'hero_form',
          message: configError instanceof Error ? configError.message : 'Unknown configuration error',
        },
        { route: listingSearchRoute },
      );
      setStatusMessage('Showing all homes while we resolve a configuration issue.');
      setError('We could not confirm availability due to a configuration issue. Showing all homes instead.');
      navigate({ pathname: '/search', search: params.toString() });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(availabilityUrl ? 'Checking availability...' : 'Showing all homes while we confirm availability.');

    try {
      if (availabilityUrl) {
        const response = await fetch(availabilityUrl, { signal: controller?.signal, headers: getApiHeaders() });
        const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt);

        trackEvent(
          'availability_search_result',
          { surface: 'hero_form', ok: response.ok, status: response.status, durationMs },
          { route: listingSearchRoute },
        );

        if (!response.ok) {
          throw new Error(await messageFromApiResponse(response));
        }

        setStatusMessage('Showing available homes for your dates.');
      } else {
        setStatusMessage('Showing all homes while we confirm availability.');
      }
    } catch (fetchError: unknown) {
      const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt);
      trackEvent(
        'availability_search_result',
        { surface: 'hero_form', ok: false, status: 'error', durationMs },
        { route: listingSearchRoute },
      );
      const message =
        fetchError instanceof Error && fetchError.message?.trim()
          ? fetchError.message.trim()
          : 'We could not confirm availability right now. Showing all homes instead.';
      setError(message);
      setStatusMessage(
        fetchError instanceof Error && fetchError.message?.trim()
          ? `${fetchError.message.trim()} Showing all homes.`
          : 'Unable to confirm availability right now. Showing all homes.',
      );
      console.error('Hero availability check failed:', fetchError);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      setIsSubmitting(false);
      setIsAvailabilityModalOpen(false);
      navigate({ pathname: '/search', search: params.toString() });
    }
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


  const checkInLabel = dateRange.startDate ? format(dateRange.startDate, 'dd MMM yyyy') : 'Check-in';
  const checkOutLabel = dateRange.endDate ? format(dateRange.endDate, 'dd MMM yyyy') : 'Check-out';
  const isSubmitDisabled =
    !dateRange.startDate ||
    !dateRange.endDate ||
    dateRange.endDate <= dateRange.startDate ||
    guestCounts.adults < 1 ||
    Boolean(dateError || guestError);


  const markHeroInteraction = () => {
    if (!hasInteractedRef.current) {
      hasInteractedRef.current = true;
    }
    setHasInteracted(true);
  };

  React.useEffect(() => {
    if (!isAvailabilityModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAvailabilityModalOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAvailabilityModalOpen]);

  const formContainerClass = enableWidgetExperiment
    ? 'hero-form w-full max-w-5xl rounded-[24px] bg-[var(--bg-surface)] shadow-[var(--shadow-level-3)] backdrop-blur-sm border border-[var(--border-subtle)] p-8 flex flex-col gap-6'
    : 'hero-form w-full max-w-5xl rounded-[24px] bg-[var(--bg-surface)] shadow-[var(--shadow-level-3)] backdrop-blur-sm border border-[var(--border-subtle)] p-8 flex flex-col gap-6';

  const formGridClass = enableWidgetExperiment
    ? 'hero-form-grid grid grid-cols-1 gap-6 md:grid-cols-2 md:auto-rows-fr lg:grid-cols-4'
    : 'hero-form-grid grid grid-cols-1 gap-6 md:grid-cols-2 md:auto-rows-fr lg:grid-cols-4';

  const fieldShellClass =
    'field-card flex h-full min-h-[120px] flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-7 py-7 shadow-[var(--shadow-level-1)] hover:shadow-[var(--shadow-level-2)] hover:scale-[1.01]';
  const dateFieldShellClass = `${fieldShellClass}${
    dateError ? ' border-[var(--support-error)] shadow-[0_0_0_1px_var(--support-error)] error-shake' : ''
  }`;
  const labelClass =
    'flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.10em] text-[var(--text-muted)] whitespace-nowrap';
  return (
    <form onSubmit={handleSubmit} className={formContainerClass} data-testid="search-input" id="search-form">
      <div className="sr-only" role="status" aria-live="polite">
        {statusMessage || error || 'Hero form ready.'}
      </div>
      <div className={formGridClass} ref={calendarWrapperRef}>
        <div className="relative">
          <button
            type="button"
            className={`${dateFieldShellClass} text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary${activeField === 'checkin' && isCalendarOpen ? ' ring-2 ring-[var(--cta-primary)] ring-offset-2' : ''}`}
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
              <CalendarRange className="h-[18px] w-[18px] shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
              <span className="truncate">Check-in</span>
            </span>
            <span className="date-value mt-4 flex items-center justify-between gap-2 text-[22px] font-medium text-[var(--text-primary)] leading-tight">
              {checkInLabel}
              <ChevronDown className={`h-[18px] w-[18px] shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${isCalendarOpen ? 'rotate-180' : ''}`} aria-hidden />
            </span>
            {dateError && (
              <span className="mt-2 text-sm font-semibold text-support-error" id={dateErrorId} role="alert">
                {dateError}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          className={`${dateFieldShellClass} text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary md:-ml-[1px]${activeField === 'checkout' && isCalendarOpen ? ' ring-2 ring-[var(--cta-primary)] ring-offset-2' : ''}`}
          aria-label="Click to select check-out date, then choose from calendar"
          title="Click to select check-out date, then choose from calendar"
          aria-expanded={isCalendarOpen}
          aria-describedby={dateError ? dateErrorId : undefined}
          aria-invalid={dateError ? true : undefined}
          onClick={() => toggleCalendar('checkout')}
          aria-controls={calendarContentId}
        >
          <span className={labelClass}>
            <CalendarRange className="h-[18px] w-[18px] shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            <span className="truncate">Check-out</span>
          </span>
          <span className="date-value mt-4 flex items-center justify-between gap-2 text-[22px] font-medium text-[var(--text-primary)] leading-tight">
            {checkOutLabel}
            <ChevronDown className={`h-[18px] w-[18px] shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${isCalendarOpen ? 'rotate-180' : ''}`} aria-hidden />
          </span>
          {dateRange.startDate && dateRange.endDate && calculateNights(dateRange.startDate, dateRange.endDate) > 0 && (
            <div className="mt-3 flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-primary)] bg-[var(--bg-muted)] px-3 py-1.5 rounded-lg">
                {formatNightCount(calculateNights(dateRange.startDate, dateRange.endDate))}
              </span>
            </div>
          )}
        </button>

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
          ? 'bg-[var(--cta-primary)] text-white rounded-xl px-3 py-2 shadow-sm'
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

        <div className={`${fieldShellClass} md:-ml-[1px] lg:min-h-[120px] lg:items-stretch lg:justify-center lg:flex-col`}>
          <button
            type="submit"
            disabled={isSubmitDisabled || isSubmitting}
            data-testid="hero-search-submit"
            className="inline-flex h-[60px] w-full items-center justify-center rounded-[14px] bg-gradient-to-br from-[var(--cta-primary)] to-[var(--cta-primary-hover)] px-6 text-base font-semibold tracking-[0.02em] text-white shadow-[var(--shadow-level-2)] transition-all hover:scale-[1.02] hover:shadow-[var(--shadow-level-3)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cta-primary)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:scale-100 aria-busy:cursor-progress aria-busy:opacity-90 whitespace-nowrap"
            onClick={() => setStatusMessage('Checking availability...')}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Checking...' : 'Check availability'}
          </button>
          <Link
            to="/#our-homes"
            className="group inline-flex items-center justify-center gap-1 text-[14px] font-medium text-[var(--cta-primary)] transition-all hover:text-[var(--text-body)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#475569] whitespace-nowrap mt-3"
            data-discover="true"
          >
            Browse all apartments
            <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </Link>
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

      <div className="flex flex-col gap-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--bg-muted)] px-6 py-5 text-left md:flex-row md:items-center md:gap-4">
        <div className="flex items-center gap-2 text-[15px] font-bold text-[var(--text-body)]">
          <ShieldCheck className="h-4 w-4 text-[var(--cta-primary)]" aria-hidden="true" />
          <span>Book with confidence</span>
        </div>
        <p className="text-[13px] text-[var(--cta-primary)] md:border-l md:border-[var(--border-subtle)] md:pl-4">
          Instant confirmation • Secure payment • Flexible cancellation
        </p>
      </div>

      {isAvailabilityModalOpen && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[color:color-mix(in_srgb,var(--text-primary)_70%,transparent)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="availability-modal-title"
          aria-describedby="availability-modal-description"
          onClick={() => setIsAvailabilityModalOpen(false)}
        >
          <div
            className="relative w-[90%] max-w-lg rounded-2xl bg-bg-surface p-6 shadow-level3"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="availability-modal-title" className="text-xl font-semibold text-text-primary">
              Availability
            </h3>
            <p id="availability-modal-description" className="mt-3 text-sm text-text-muted">
              Good news! More than one home is available for your dates.
            </p>
            <p className="mt-2 text-sm text-text-muted">
              Soon you’ll be able to book split stays across multiple apartments without leaving this page.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-text-primary underline-offset-4 transition hover:text-cta-secondary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                onClick={() => setIsAvailabilityModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg bg-cta-primary px-4 py-2 text-sm font-semibold text-[var(--text-contrast)] shadow-sm transition hover:bg-cta-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                onClick={() => pendingSearchParams && performAvailabilityCheck(pendingSearchParams)}
                disabled={!pendingSearchParams || isSubmitting}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default SearchAvailabilityWidget;
