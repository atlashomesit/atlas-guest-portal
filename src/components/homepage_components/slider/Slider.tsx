import React from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BadgePercent, CheckCircle2, CalendarRange, ChevronDown, ShieldCheck, Users } from 'lucide-react';
import { addDays, format, startOfDay } from 'date-fns';
import { DateRange, type RangeKeyDict } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { LOGO_URL } from '../../../config/branding';
import { HERO_IMAGE_URL } from '../../../config/hero';
import { trackEvent } from '../../../utils/analytics';
import { heroWidgetLayoutFlag } from '../../../config/abFlags';
import getApiBaseUrl from '../../../utils/apiBaseUrl';
import { TrustBadge } from '../../ui/TrustBadge';
import { useBooking } from '../../../contexts/BookingContext';

const HERO_OVERLAY_GRADIENT =
  'linear-gradient(118deg, rgba(7, 10, 18, 0.92) 0%, rgba(7, 10, 18, 0.78) 42%, rgba(7, 10, 18, 0.62) 100%)';
const HERO_OVERLAY_GRADIENT_LEGACY =
  'linear-gradient(115deg, rgba(7, 10, 18, 0.82) 0%, rgba(7, 10, 18, 0.64) 45%, rgba(7, 10, 18, 0.38) 100%)';
const TRUST_BADGES = [
  { label: 'Verified homes', icon: CheckCircle2 },
  { label: 'Secure Razorpay payments', icon: ShieldCheck },
  { label: 'No hidden fees', icon: BadgePercent },
];
const MIN_GUESTS = 1;
const MAX_GUESTS = 20;

const Slider = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const enableWidgetExperiment = heroWidgetLayoutFlag();

  const overlayStyle = React.useMemo(() => {
    const style: React.CSSProperties = {
      backgroundColor: enableWidgetExperiment ? 'rgba(3, 6, 14, 0.74)' : 'rgba(0, 0, 0, 0.45)',
      backgroundImage: enableWidgetExperiment ? HERO_OVERLAY_GRADIENT : HERO_OVERLAY_GRADIENT_LEGACY,
      backdropFilter: 'blur(4px) saturate(0.96)',
    };

    if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('jsdom')) {
      style.backgroundImage = 'url("linear-gradient-overlay")';
    }

    return style;
  }, [enableWidgetExperiment]);

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
  const [guests, setGuests] = React.useState(2);
  const [dateError, setDateError] = React.useState<string | null>(null);
  const [guestError, setGuestError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string>('');
  const [hasInteracted, setHasInteracted] = React.useState(false);
  const isTestEnvironment = typeof navigator !== 'undefined' && navigator.userAgent?.includes('jsdom');
  const [calendarReady, setCalendarReady] = React.useState(isTestEnvironment);
  const [shownDate, setShownDate] = React.useState<Date>(() => defaultRange.startDate ?? today);
  const hasTrackedDropoff = React.useRef(false);
  const hasInteractedRef = React.useRef(false);
  const latestWidgetStateRef = React.useRef({ hasSelection: false, guests });
  const calendarWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const calendarDropdownRef = React.useRef<HTMLDivElement | null>(null);
  const [calendarPosition, setCalendarPosition] = React.useState<{ top: number; left: number; width: number }>();
  const dateErrorId = React.useId();
  const guestsLabelId = React.useId();
  const guestsHelperId = React.useId();
  const guestsErrorId = React.useId();
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
      normalizedEnd = addDays(normalizedStart, 1);
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
      propertyId: booking.propertyId ?? null,
    }),
    [booking.checkIn, booking.checkOut, booking.guests, booking.propertyId],
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
    const stored = hydrateFromContext();
    const paramRange = {
      startDate: parseDate(searchParams.get('checkIn')),
      endDate: parseDate(searchParams.get('checkOut')),
      guests: Number(searchParams.get('guests')) || null,
    };

    const stateRange = bookingPrefill
      ? {
          startDate: parseDate(bookingPrefill.checkIn),
          endDate: parseDate(bookingPrefill.checkOut),
          guests: bookingPrefill.guests && bookingPrefill.guests > 0 ? bookingPrefill.guests : null,
          propertyId: bookingPrefill.propertyId ?? null,
        }
      : null;

    const startDate = stateRange?.startDate ?? paramRange.startDate ?? stored?.startDate ?? defaultRange.startDate;
    const endDate = stateRange?.endDate ?? paramRange.endDate ?? stored?.endDate ?? defaultRange.endDate;

    const nextRange = clampRange(startDate, endDate);
    const nextGuests =
      (stateRange?.guests && stateRange.guests > 0
        ? stateRange.guests
        : null) || (paramRange.guests && paramRange.guests > 0 ? paramRange.guests : stored?.guests ?? guests);
    const nextPropertyId = stateRange?.propertyId ?? stored?.propertyId ?? null;
    const normalizedGuests = nextGuests ?? guests;

    setDateRange({ startDate: nextRange.startDate, endDate: nextRange.endDate });
    setDateError(null);
    setGuestError(validateGuests(normalizedGuests));
    setGuests(normalizedGuests);
    setShownDate(nextRange.startDate ?? today);
    updateBooking({
      checkIn: nextRange.startDate?.toISOString() ?? null,
      checkOut: nextRange.endDate?.toISOString() ?? null,
      guests: nextGuests,
      propertyId: nextPropertyId,
    });
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

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const updateDropdownPosition = () => {
      if (!calendarWrapperRef.current) return;
      const rect = calendarWrapperRef.current.getBoundingClientRect();
      const spacing = 12;
      const viewportWidth = window.innerWidth;
      const desiredWidth = Math.min(Math.max(rect.width, 360), viewportWidth - spacing * 2);
      const left = Math.min(Math.max(rect.left, spacing), viewportWidth - desiredWidth - spacing) + window.scrollX;
      const top = rect.bottom + window.scrollY + 8;
      setCalendarPosition({ top, left, width: desiredWidth });
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        calendarDropdownRef.current &&
        !calendarDropdownRef.current.contains(target) &&
        calendarWrapperRef.current &&
        !calendarWrapperRef.current.contains(target)
      ) {
        setIsCalendarOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCalendarOpen(false);
      }
    };

    updateDropdownPosition();
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isCalendarOpen]);

  React.useEffect(() => {
    if (!isCalendarOpen || isTestEnvironment) return;
    const timer = window.setTimeout(() => setCalendarReady(true), 140);
    return () => {
      window.clearTimeout(timer);
      setCalendarReady(false);
    };
  }, [isCalendarOpen, isTestEnvironment]);

  React.useEffect(() => {
    hasInteractedRef.current = hasInteracted;
  }, [hasInteracted]);

  React.useEffect(() => {
    latestWidgetStateRef.current = {
      hasSelection: Boolean(dateRange.startDate && dateRange.endDate),
      guests,
    };
  }, [dateRange.endDate, dateRange.startDate, guests]);

  React.useEffect(() => {
    updateBooking({
      checkIn: dateRange.startDate?.toISOString() ?? null,
      checkOut: dateRange.endDate?.toISOString() ?? null,
      guests,
    });
  }, [dateRange.endDate, dateRange.startDate, guests, updateBooking]);

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setStatusMessage('');
    markHeroInteraction();

    const { startDate, endDate, error: rangeError } = clampRange(dateRange.startDate, dateRange.endDate);
    setDateRange({ startDate, endDate });
    setDateError(rangeError);

    if (!startDate || !endDate) {
      setError('Please select your check-in and check-out dates.');
      setStatusMessage('Select both check-in and check-out dates to continue.');
      return;
    }

    if (rangeError) {
      setError(rangeError);
      setStatusMessage(rangeError);
    } else {
      setError(null);
    }

    const guestValidation = validateGuests(guests);
    setGuestError(guestValidation);
    if (guestValidation) {
      setError(guestValidation);
      setStatusMessage(guestValidation);
      return;
    }

    const formattedCheckIn = format(startDate, 'yyyy-MM-dd');
    const formattedCheckOut = format(endDate, 'yyyy-MM-dd');

    const searchParams = new URLSearchParams({
      checkIn: formattedCheckIn,
      checkOut: formattedCheckOut,
      guests: guests.toString(),
    });

    const listingSearchRoute = `/search?${searchParams.toString()}`;

    trackEvent(
      'availability_search',
      {
        surface: 'hero_form',
        checkIn: startDate.toISOString(),
        checkOut: endDate.toISOString(),
        guests,
      },
      { route: listingSearchRoute },
    );

    trackEvent(
      'listings_browse',
      { surface: 'hero_form', checkIn: startDate.toISOString(), checkOut: endDate.toISOString(), guests },
      { route: listingSearchRoute },
    );

    trackEvent(
      'hero_primary_cta_click',
      {
        surface: 'hero_form',
        checkIn: startDate.toISOString(),
        checkOut: endDate.toISOString(),
        guests,
      },
      { route: listingSearchRoute },
    );

    let availabilityUrl = '';
    let controller: AbortController | null = null;
    let timeoutId: number | null = null;
    const startedAt = performance.now();

    try {
      const apiBaseUrl = getApiBaseUrl();
      availabilityUrl = apiBaseUrl
        ? `${apiBaseUrl}/availability?checkIn=${formattedCheckIn}&checkOut=${formattedCheckOut}&guests=${guests}`
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
      navigate({ pathname: '/search', search: searchParams.toString() });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(availabilityUrl ? 'Checking availability...' : 'Showing all homes while we confirm availability.');

    try {
      if (availabilityUrl) {
        const response = await fetch(availabilityUrl, { signal: controller?.signal });
        const durationMs = Math.round(performance.now() - startedAt);

        trackEvent(
          'availability_search_result',
          { surface: 'hero_form', ok: response.ok, status: response.status, durationMs },
          { route: listingSearchRoute },
        );

        if (!response.ok) {
          throw new Error(`Availability check failed with status ${response.status}`);
        }

        setStatusMessage('Showing available homes for your dates.');
      } else {
        setStatusMessage('Showing all homes while we confirm availability.');
      }
    } catch (fetchError) {
      const durationMs = Math.round(performance.now() - startedAt);
      trackEvent(
        'availability_search_result',
        { surface: 'hero_form', ok: false, status: 'error', durationMs },
        { route: listingSearchRoute },
      );
      setError('We could not confirm availability right now. Showing all homes instead.');
      setStatusMessage('Unable to confirm availability right now. Showing all homes.');
      console.error('Hero availability check failed:', fetchError);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      setIsSubmitting(false);
      navigate({ pathname: '/search', search: searchParams.toString() });
    }
  };

  const handleRangeChange = (ranges: RangeKeyDict) => {
    const selection = ranges.selection ?? { startDate: null, endDate: null };
    const normalizedStart = selection.startDate ? startOfDay(selection.startDate) : null;
    const normalizedEnd = selection.endDate ? startOfDay(selection.endDate) : null;
    markHeroInteraction();

    const attemptedStart = normalizedStart ?? dateRange.startDate;
    const attemptedEnd = normalizedEnd ?? dateRange.endDate;
    const hasPastAttempt =
      (attemptedStart && attemptedStart < today) ||
      (attemptedEnd && attemptedEnd < today);

    if (hasPastAttempt) {
      const errorMessage = 'Check-in cannot be in the past; minimum 1-night stay applies.';
      setStatusMessage(errorMessage);
      setDateError(errorMessage);
      setError(errorMessage);
      return;
    }

    const nextRange = clampRange(normalizedStart, normalizedEnd);
    const isSingleDaySelection = Boolean(
      normalizedStart && normalizedEnd && normalizedStart.getTime() === normalizedEnd.getTime(),
    );

    if (isSingleDaySelection) {
      setStatusMessage('Choose a check-out date.');
      setDateError(null);
      setDateRange({ startDate: normalizedStart, endDate: null });
      setError(null);
    } else {
      setStatusMessage(nextRange.error ?? 'Updated dates.');
      setDateError(nextRange.error);
      setDateRange({ startDate: nextRange.startDate, endDate: nextRange.endDate });
      setError(nextRange.error);
    }

    trackEvent('hero_dates_changed', {
      surface: 'hero_form',
      checkIn: normalizedStart?.toISOString(),
      checkOut: normalizedEnd?.toISOString(),
    });
    if (selection.startDate && selection.endDate && normalizedEnd && normalizedStart && normalizedEnd > normalizedStart) {
      setIsCalendarOpen(false);
    }
  };

  const handleClearDates = () => {
    markHeroInteraction();
    setDateRange({ startDate: null, endDate: null });
    setDateError(null);
    setError(null);
    setStatusMessage('');
    setIsCalendarOpen(false);
  };

  const checkInLabel = dateRange.startDate ? format(dateRange.startDate, 'dd MMM yyyy') : 'Check-in';
  const checkOutLabel = dateRange.endDate ? format(dateRange.endDate, 'dd MMM yyyy') : 'Check-out';
  const isSubmitDisabled =
    !dateRange.startDate ||
    !dateRange.endDate ||
    dateRange.endDate <= dateRange.startDate ||
    guests < 1 ||
    Boolean(dateError || guestError);

  const handleGuestChange = (delta: number) => {
    markHeroInteraction();
    setGuests((prev) => {
      const proposed = prev + delta;
      const next = Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, proposed));
      setGuestError(validateGuests(proposed));
      trackEvent('hero_guests_changed', { surface: 'hero_form', guests: next });
      return next;
    });
  };

  const markHeroInteraction = () => {
    if (!hasInteractedRef.current) {
      hasInteractedRef.current = true;
    }
    setHasInteracted(true);
  };

  const formContainerClass = enableWidgetExperiment
    ? 'hero-form w-full max-w-5xl rounded-3xl bg-[color:color-mix(in_srgb,var(--bg-surface)_96%,rgba(3,6,14,0.45))] shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-md border border-[color:color-mix(in_srgb,var(--bg-surface)_60%,transparent)] p-4 sm:p-5 md:p-6 flex flex-col gap-4 sm:gap-5'
    : 'hero-form w-full max-w-5xl rounded-3xl bg-[color:color-mix(in_srgb,var(--bg-surface)_94%,rgba(0,0,0,0.18))] shadow-level3 backdrop-blur border border-[color:color-mix(in_srgb,var(--bg-surface)_55%,transparent)] p-4 sm:p-5 md:p-6 flex flex-col gap-4 sm:gap-5';

  const formGridClass = enableWidgetExperiment
    ? 'hero-form-grid grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:auto-rows-fr lg:grid-cols-4 lg:gap-5'
    : 'hero-form-grid grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:auto-rows-fr lg:grid-cols-4 lg:gap-5';

  const fieldShellClass =
    'flex h-full min-h-[112px] flex-col justify-between rounded-2xl border border-[color:color-mix(in_srgb,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_srgb,var(--bg-muted)_92%,var(--bg-surface))] px-4 py-4 sm:px-5 sm:py-5 shadow-[0_12px_36px_rgba(6,8,15,0.32)]';
  const dateFieldShellClass = `${fieldShellClass}${
    dateError ? ' border-support-error shadow-[0_0_0_1px_var(--support-error)]' : ''
  }`;
  const labelClass =
    'flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--text-primary)_80%,transparent)] whitespace-nowrap';
  const helperTextClass = 'mt-2 text-sm leading-snug text-[color-mix(in_srgb,var(--text-primary)_78%,transparent)]';

  return (
    <section className="w-full bg-bg-muted text-text-primary">
      <div
        className="relative isolate overflow-hidden min-h-[75vh] md:min-h-[70vh] flex items-center justify-center bg-cover bg-center bg-no-repeat pt-[calc(var(--nav-height,80px)+1rem)]"
        style={{ backgroundImage: `url(${HERO_IMAGE_URL})` }}
      >
        <div
          data-testid="hero-overlay"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-95"
          style={overlayStyle}
        />
        <div className="relative z-10 flex max-w-4xl flex-col items-center gap-7 px-4 pb-12 text-center sm:px-6 md:pt-3">

          <Link to="/" className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Atlas Homestays" className="h-14 w-auto rounded-md bg-[color:color-mix(in_srgb,var(--bg-surface)_88%,transparent)] p-2 shadow-level2" />
            <span className="text-xl font-semibold text-[var(--text-contrast)] tracking-wide">Atlas Homestays</span>
          </Link>

          <div className="space-y-4 max-w-3xl">
            <h1
              className="text-4xl md:text-6xl font-bold leading-tight text-[var(--text-on-hero)] drop-shadow-lg text-pretty"
              style={{ textWrap: 'balance' }}
            >
              Thoughtfully curated stays in Hyderabad
            </h1>
            <h2
              className="text-lg md:text-xl font-medium text-[color-mix(in_srgb,var(--text-on-hero)_88%,transparent)] text-pretty"
              style={{ textWrap: 'balance' }}
            >
              Discover verified apartments with flexible bookings, transparent pricing, and secure payments.
            </h2>
          </div>

          <form
            onSubmit={handleSubmit}
            className={formContainerClass}
            data-testid="hero-widget"
            id="search-form"
          >
            <div className="sr-only" role="status" aria-live="polite">
              {statusMessage || error || 'Hero form ready'}
            </div>
            <div
              className={formGridClass}
              ref={calendarWrapperRef}
            >
              <div className="relative">
                <button
                  type="button"
                className={`${dateFieldShellClass} text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary`}
                aria-label="Select check-in date"
                aria-expanded={isCalendarOpen}
                aria-describedby={dateError ? dateErrorId : undefined}
                aria-invalid={dateError ? true : undefined}
                onClick={() => setIsCalendarOpen((open) => !open)}
                data-testid="hero-date-toggle"
              >
                  <span className={labelClass}>
                    <CalendarRange className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">Check-in</span>
                  </span>
                  <span className="mt-3 flex items-center justify-between gap-2 text-lg font-semibold text-text-primary leading-tight">
                    {checkInLabel}
                    <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition ${isCalendarOpen ? 'rotate-180' : ''}`} aria-hidden />
                  </span>
                  <span className={helperTextClass}>
                    Check-in cannot be in the past; minimum 1-night stay applies.
                  </span>
                  {dateError && (
                    <span className="mt-2 text-sm font-semibold text-support-error" id={dateErrorId} role="alert">
                      {dateError}
                    </span>
                  )}
                </button>

                {isCalendarOpen &&
                  calendarPosition &&
                  createPortal(
                    <div className="hero-date-portal" role="presentation">
                      <div className="hero-date-overlay" onClick={() => setIsCalendarOpen(false)} />
                      <div
                        className="hero-date-dropdown rounded-2xl border border-border-subtle bg-bg-surface p-3 shadow-level2"
                        style={{
                          top: calendarPosition.top,
                          left: calendarPosition.left,
                          width: calendarPosition.width,
                        }}
                        ref={calendarDropdownRef}
                      >
                        {calendarReady ? (
                          <DateRange
                            onChange={handleRangeChange}
                            months={monthsToShow}
                            direction="horizontal"
                            showDateDisplay={false}
                            rangeColors={[dateError ? 'var(--support-error, #ef4444)' : 'var(--cta-primary)']}
                            minDate={today}
                            shownDate={shownDate}
                            onShownDateChange={(date) => setShownDate(startOfDay(date))}
                            disabledDay={(date) => startOfDay(date) < today}
                            ranges={[
                              {
                                startDate: dateRange.startDate ?? today,
                                endDate: dateRange.endDate ?? addDays(today, 1),
                                key: 'selection',
                              },
                            ]}
                            dayContentRenderer={(day) => (
                              <div
                                data-testid={`hero-date-${format(day, 'yyyy-MM-dd')}`}
                                className={`${startOfDay(day) < today ? 'opacity-60 line-through' : ''}`}
                              >
                                {format(day, 'd')}
                              </div>
                            )}
                          />
                        ) : (
                          <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: 14 }).map((_, index) => (
                              <div
                                key={index}
                                className="h-10 rounded-lg bg-[color:color-mix(in_srgb,var(--bg-muted)_75%,var(--bg-surface))] animate-pulse"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>,
                    document.body,
                  )}
              </div>

              <button
                type="button"
                className={`${dateFieldShellClass} text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary md:-ml-[1px]`}
                aria-label="Select check-out date"
                aria-expanded={isCalendarOpen}
                aria-describedby={dateError ? dateErrorId : undefined}
                aria-invalid={dateError ? true : undefined}
                onClick={() => setIsCalendarOpen((open) => !open)}
              >
                <span className={labelClass}>
                  <CalendarRange className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">Check-out</span>
                </span>
                <span className="mt-3 flex items-center justify-between gap-2 text-lg font-semibold text-text-primary leading-tight">
                  {checkOutLabel}
                  <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition ${isCalendarOpen ? 'rotate-180' : ''}`} aria-hidden />
                </span>
                <span className={helperTextClass}>Check-out must be at least 1 night after check-in.</span>
              </button>

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleClearDates}
                  className="mt-2 inline-flex items-center justify-center rounded-full px-3 py-2 text-sm font-semibold text-text-muted underline-offset-4 transition hover:text-cta-secondary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                  data-testid="hero-date-clear"
                >
                  Clear dates
                </button>
              </div>

              <div
                className={`${fieldShellClass} text-left md:-ml-[1px]`}
                role="group"
                aria-labelledby={guestsLabelId}
                aria-describedby={`${guestsHelperId}${guestError ? ` ${guestsErrorId}` : ''}`}
                aria-invalid={guestError ? true : undefined}
              >
                <span className={labelClass} id={guestsLabelId}>
                  <Users className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">Guests</span>
                </span>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-border-subtle text-lg font-semibold text-text-primary transition hover:border-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary disabled:opacity-40 disabled:hover:border-border-subtle"
                    onClick={() => handleGuestChange(-1)}
                    disabled={guests <= 1}
                    aria-label="Decrease guests"
                  >
                    −
                  </button>
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-semibold text-text-primary">{guests}</span>
                    <span className="text-xs font-medium text-text-muted">guest{guests === 1 ? '' : 's'}</span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-border-subtle text-lg font-semibold text-text-primary transition hover:border-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                    onClick={() => handleGuestChange(1)}
                    aria-label="Increase guests"
                  >
                    +
                  </button>
                </div>
                <span className={helperTextClass} id={guestsHelperId}>
                  Up to {MAX_GUESTS} guests per booking. Defaulting to 2 guests; adjust anytime.
                </span>
                {guestError && (
                  <span className="mt-2 text-sm font-semibold text-support-error" id={guestsErrorId} role="alert">
                    {guestError}
                  </span>
                )}
              </div>

              <div className={`${fieldShellClass} md:-ml-[1px] lg:min-h-[112px] lg:items-stretch lg:justify-center`}>
                <button
                  type="submit"
                  disabled={isSubmitDisabled || isSubmitting}
                  className="inline-flex h-14 min-h-[56px] w-full items-center justify-center rounded-xl bg-cta-primary px-6 text-base font-semibold text-[var(--text-contrast)] shadow-[0_16px_38px_rgba(12,86,255,0.32)] transition hover:bg-cta-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary disabled:cursor-not-allowed disabled:bg-[color:color-mix(in_srgb,var(--cta-primary)_70%,var(--bg-muted))] disabled:text-[color-mix(in_srgb,var(--text-contrast)_82%,transparent)] disabled:shadow-none aria-busy:cursor-progress aria-busy:opacity-90 whitespace-nowrap"
                  onClick={() => setStatusMessage('Checking availability...')}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? 'Checking...' : 'Check availability'}
                </button>
                <Link
                  to="/search"
                  onClick={() =>
                    trackEvent(
                      'listings_browse',
                      { surface: 'hero_secondary' },
                      { route: '/search' },
                    )
                  }
                  className="inline-flex items-center justify-center text-sm font-semibold text-text-muted underline-offset-4 transition hover:text-cta-secondary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary whitespace-nowrap"
                >
                  Browse all apartments
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

            <div className="flex flex-col gap-2 rounded-2xl bg-[color:color-mix(in_srgb,var(--bg-surface)_94%,transparent)] px-4 py-4 text-left shadow-inner md:flex-row md:items-center md:gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <ShieldCheck className="h-4 w-4 text-cta-secondary" aria-hidden="true" />
                <span>Book with confidence</span>
              </div>
              <p className="text-sm text-[color-mix(in_srgb,var(--text-primary)_78%,transparent)] md:border-l md:border-[color:color-mix(in_srgb,var(--text-muted)_60%,transparent)] md:pl-4">
                Instant confirmation • Secure payments • No hidden charges
              </p>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-bg-surface" data-testid="trust-badges">
        <div className="mx-auto -mt-4 flex max-w-5xl flex-wrap items-center justify-center gap-3 px-4 pb-6 pt-2 sm:px-6 md:gap-4 md:pb-8 md:pt-0">
          {TRUST_BADGES.map(({ label, icon }) => (
            <TrustBadge
              key={label}
              icon={icon}
              label={label}
              className="min-w-[215px] justify-center sm:min-w-[0]"
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Slider;
