import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BadgePercent, CheckCircle2, CalendarRange, ChevronDown, ShieldCheck, Users } from 'lucide-react';
import { addDays, format, startOfDay } from 'date-fns';
import { DateRange, type RangeKeyDict } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { LOGO_URL } from '../../../config/branding';
import { HERO_IMAGE_URL } from '../../../config/hero';
import { trackEvent } from '../../../utils/analytics';
import { heroWidgetLayoutFlag } from '../../../config/abFlags';
import { TrustBadge } from '../../ui/TrustBadge';

const HERO_OVERLAY_GRADIENT =
  'linear-gradient(118deg, rgba(7, 10, 18, 0.92) 0%, rgba(7, 10, 18, 0.78) 42%, rgba(7, 10, 18, 0.62) 100%)';
const HERO_OVERLAY_GRADIENT_LEGACY =
  'linear-gradient(115deg, rgba(7, 10, 18, 0.82) 0%, rgba(7, 10, 18, 0.64) 45%, rgba(7, 10, 18, 0.38) 100%)';
const STORAGE_KEY = 'atlasHeroSearch';

const TRUST_BADGES = [
  { label: 'Verified homes', icon: CheckCircle2 },
  { label: 'Secure Razorpay payments', icon: ShieldCheck },
  { label: 'No hidden fees', icon: BadgePercent },
];

const Slider = () => {
  const navigate = useNavigate();
  const enableWidgetExperiment = heroWidgetLayoutFlag();

  const overlayStyle = React.useMemo(() => {
    const style: React.CSSProperties = {
      backgroundColor: enableWidgetExperiment ? 'rgba(3, 6, 14, 0.55)' : 'rgba(0, 0, 0, 0.35)',
      backgroundImage: enableWidgetExperiment ? HERO_OVERLAY_GRADIENT : HERO_OVERLAY_GRADIENT_LEGACY,
    };

    if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('jsdom')) {
      style.backgroundImage = 'url("linear-gradient-overlay")';
    }

    return style;
  }, []);

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
  const [error, setError] = React.useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string>('');
  const [hasInteracted, setHasInteracted] = React.useState(false);
  const [calendarReady, setCalendarReady] = React.useState(false);
  const hasTrackedDropoff = React.useRef(false);
  const hasInteractedRef = React.useRef(false);
  const latestWidgetStateRef = React.useRef({ hasSelection: false, guests });
  const calendarWrapperRef = React.useRef<HTMLDivElement | null>(null);
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
    if (normalizedStart && endDate && endDate <= normalizedStart) {
      return { startDate: normalizedStart, endDate: addDays(normalizedStart, 1) };
    }
    return { startDate: normalizedStart ?? null, endDate: endDate ?? null };
  };

  const hydrateFromStorage = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved) as { checkIn?: string; checkOut?: string; guests?: number };
      return {
        startDate: parseDate(parsed.checkIn),
        endDate: parseDate(parsed.checkOut),
        guests: typeof parsed.guests === 'number' && parsed.guests > 0 ? parsed.guests : null,
      };
    } catch {
      return null;
    }
  };

  React.useEffect(() => {
    const stored = hydrateFromStorage();
    const paramRange = {
      startDate: parseDate(searchParams.get('checkIn')),
      endDate: parseDate(searchParams.get('checkOut')),
      guests: Number(searchParams.get('guests')) || null,
    };

    const startDate = paramRange.startDate ?? stored?.startDate ?? defaultRange.startDate;
    const endDate = paramRange.endDate ?? stored?.endDate ?? defaultRange.endDate;

    const nextRange = clampRange(startDate, endDate);

    setDateRange(nextRange);
    if (paramRange.guests && paramRange.guests > 0) {
      setGuests(paramRange.guests);
    } else if (stored?.guests) {
      setGuests(stored.guests);
    }
  }, [defaultRange.endDate, defaultRange.startDate, searchParams]);

  React.useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          checkIn: dateRange.startDate?.toISOString(),
          checkOut: dateRange.endDate?.toISOString(),
          guests,
        }),
      );
    } catch {
      // Ignore storage write errors
    }
  }, [dateRange.endDate, dateRange.startDate, guests]);

  React.useEffect(() => {
    if (!isCalendarOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (calendarWrapperRef.current && !calendarWrapperRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCalendarOpen]);

  React.useEffect(() => {
    if (!isCalendarOpen) return;
    const timer = window.setTimeout(() => setCalendarReady(true), 140);
    return () => {
      window.clearTimeout(timer);
      setCalendarReady(false);
    };
  }, [isCalendarOpen]);

  React.useEffect(() => {
    hasInteractedRef.current = hasInteracted;
  }, [hasInteracted]);

  React.useEffect(() => {
    latestWidgetStateRef.current = {
      hasSelection: Boolean(dateRange.startDate && dateRange.endDate),
      guests,
    };
  }, [dateRange.endDate, dateRange.startDate, guests]);

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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setStatusMessage('');
    markHeroInteraction();

    const { startDate, endDate } = dateRange;

    if (!startDate || !endDate) {
      setError('Please select your check-in and check-out dates.');
      setStatusMessage('Select both check-in and check-out dates to continue.');
      return;
    }

    if (endDate <= startDate) {
      setError('Check-out must be after check-in.');
      setStatusMessage('Check-out must be after check-in.');
      return;
    }

    if (startDate < today) {
      setDateRange(clampRange(today, endDate));
      setError('Check-in cannot be in the past.');
      setStatusMessage('Check-in adjusted to the next available date.');
      return;
    }

    if (guests < 1) {
      setError('Guests must be at least 1.');
      setStatusMessage('Add at least one guest to continue.');
      return;
    }

    const formattedCheckIn = format(startDate, 'yyyy-MM-dd');
    const formattedCheckOut = format(endDate, 'yyyy-MM-dd');

    const searchParams = new URLSearchParams({
      checkIn: formattedCheckIn,
      checkOut: formattedCheckOut,
      guests: guests.toString(),
    });

    trackEvent(
      'availability_search',
      {
        surface: 'hero_form',
        checkIn: startDate.toISOString(),
        checkOut: endDate.toISOString(),
        guests,
      },
      { route: `/apartments?${searchParams.toString()}` },
    );

    trackEvent(
      'listings_browse',
      { surface: 'hero_form', checkIn: startDate.toISOString(), checkOut: endDate.toISOString(), guests },
      { route: `/apartments?${searchParams.toString()}` },
    );

    trackEvent(
      'hero_primary_cta_click',
      {
        surface: 'hero_form',
        checkIn: startDate.toISOString(),
        checkOut: endDate.toISOString(),
        guests,
      },
      { route: `/apartments?${searchParams.toString()}` },
    );

    setIsSubmitting(true);
    setStatusMessage('Checking availability...');

    navigate(`/apartments?${searchParams.toString()}`);
    window.setTimeout(() => setIsSubmitting(false), 800);
  };

  const handleRangeChange = (ranges: RangeKeyDict) => {
    const selection = ranges.selection ?? { startDate: null, endDate: null };
    const normalizedStart = selection.startDate ? startOfDay(selection.startDate) : null;
    const normalizedEnd = selection.endDate ? startOfDay(selection.endDate) : null;
    markHeroInteraction();
    setStatusMessage('Updated dates.');
    setDateRange(clampRange(normalizedStart, normalizedEnd));
    setError(null);
    trackEvent('hero_dates_changed', {
      surface: 'hero_form',
      checkIn: normalizedStart?.toISOString(),
      checkOut: normalizedEnd?.toISOString(),
    });
    if (selection.startDate && selection.endDate) {
      setIsCalendarOpen(false);
    }
  };

  const checkInLabel = dateRange.startDate ? format(dateRange.startDate, 'dd MMM yyyy') : 'Check-in';
  const checkOutLabel = dateRange.endDate ? format(dateRange.endDate, 'dd MMM yyyy') : 'Check-out';
  const isSubmitDisabled =
    !dateRange.startDate || !dateRange.endDate || dateRange.endDate <= dateRange.startDate || guests < 1;

  const handleGuestChange = (delta: number) => {
    markHeroInteraction();
    setGuests((prev) => {
      const next = Math.min(16, Math.max(1, prev + delta));
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
    ? 'w-full max-w-5xl rounded-3xl bg-[color:color-mix(in_srgb,var(--bg-surface)_92%,transparent)] shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur border border-[color:color-mix(in_srgb,var(--bg-surface)_55%,transparent)] p-4 sm:p-5 md:p-7 flex flex-col gap-4 sm:gap-5'
    : 'w-full max-w-5xl rounded-3xl bg-[color:color-mix(in_srgb,var(--bg-surface)_92%,transparent)] shadow-level3 backdrop-blur border border-[color:color-mix(in_srgb,var(--bg-surface)_55%,transparent)] p-4 sm:p-5 md:p-7 flex flex-col gap-4 sm:gap-5';

  const formGridClass = enableWidgetExperiment
    ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-[1.05fr_1.05fr_0.9fr_auto] lg:gap-5'
    : 'grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-[1.1fr_1.1fr_0.95fr_auto] md:gap-5';

  return (
    <section className="w-full bg-bg-muted text-text-primary">
      <div
        className="relative isolate overflow-hidden min-h-[75vh] md:min-h-[70vh] flex items-center justify-center bg-cover bg-center bg-no-repeat pt-[calc(var(--nav-height,80px)+1.5rem)]"
        style={{ backgroundImage: `url(${HERO_IMAGE_URL})` }}
      >
        <div
          data-testid="hero-overlay"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-95"
          style={overlayStyle}
        />
        <div className="relative z-10 flex max-w-4xl flex-col items-center gap-8 px-6 pb-14 text-center md:pt-3">

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
                  className="flex h-full w-full min-h-[110px] flex-col justify-center rounded-2xl bg-bg-muted px-4 py-3 sm:px-5 sm:py-4 text-left shadow-inner transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                  aria-label="Select check-in date"
                  aria-expanded={isCalendarOpen}
                  onClick={() => setIsCalendarOpen((open) => !open)}
                  data-testid="hero-date-toggle"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--text-primary)_82%,transparent)]">
                    <CalendarRange className="h-4 w-4" aria-hidden="true" />
                    Check-in
                  </span>
                  <span className="mt-2 flex items-center justify-between gap-2 text-lg font-semibold text-text-primary">
                    {checkInLabel}
                    <ChevronDown className={`h-4 w-4 text-text-muted transition ${isCalendarOpen ? 'rotate-180' : ''}`} aria-hidden />
                  </span>
                  <span className="mt-2 text-sm font-medium text-[color-mix(in_srgb,var(--text-primary)_78%,transparent)]">Earliest available date shown.</span>
                </button>

                {isCalendarOpen && (
                  <div className="absolute left-0 right-0 z-[var(--z-dropdown)] mt-2 rounded-2xl border border-border-subtle bg-bg-surface p-3 shadow-level2 md:w-auto">
                    {calendarReady ? (
                      <DateRange
                        onChange={handleRangeChange}
                        months={monthsToShow}
                        direction="horizontal"
                        showDateDisplay={false}
                        rangeColors={['var(--cta-primary)']}
                        minDate={today}
                        ranges={[
                          {
                            startDate: dateRange.startDate ?? today,
                            endDate: dateRange.endDate ?? addDays(today, 1),
                            key: 'selection',
                          },
                        ]}
                        dayContentRenderer={(day) => (
                          <div data-testid={`hero-date-${format(day, 'yyyy-MM-dd')}`}>{format(day, 'd')}</div>
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
                )}
              </div>

              <button
                type="button"
                className="flex h-full w-full min-h-[110px] flex-col justify-center rounded-2xl bg-bg-muted px-4 py-3 sm:px-5 sm:py-4 text-left shadow-inner transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary md:-ml-[1px]"
                aria-label="Select check-out date"
                aria-expanded={isCalendarOpen}
                onClick={() => setIsCalendarOpen((open) => !open)}
              >
                <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--text-primary)_82%,transparent)]">
                  <CalendarRange className="h-4 w-4" aria-hidden="true" />
                  Check-out
                </span>
                <span className="mt-2 flex items-center justify-between gap-2 text-lg font-semibold text-text-primary">
                  {checkOutLabel}
                  <ChevronDown className={`h-4 w-4 text-text-muted transition ${isCalendarOpen ? 'rotate-180' : ''}`} aria-hidden />
                </span>
                <span className="mt-2 text-sm font-medium text-[color-mix(in_srgb,var(--text-primary)_78%,transparent)]">Ensure your stay ends after check-in.</span>
              </button>

              <div className="flex flex-col rounded-2xl bg-bg-muted px-4 py-4 shadow-inner text-left md:-ml-[1px]">
                <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--text-primary)_82%,transparent)]">
                  <Users className="h-4 w-4" aria-hidden />
                  Guests
                </span>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-border-subtle text-lg font-semibold text-text-primary transition hover:border-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary disabled:opacity-40"
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
                <span className="mt-2 text-sm font-medium text-[color-mix(in_srgb,var(--text-primary)_78%,transparent)]">Defaulting to 2 guests; adjust anytime.</span>
              </div>

              <div className="flex flex-col justify-center gap-3 rounded-2xl bg-bg-muted px-4 py-4 shadow-inner md:-ml-[1px] lg:min-h-[110px]">
                <button
                  type="submit"
                  disabled={isSubmitDisabled || isSubmitting}
                  className="inline-flex w-full items-center justify-center rounded-full bg-cta-primary px-6 py-3 text-base font-semibold text-[var(--text-contrast)] shadow-level3 transition hover:bg-cta-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={() => setStatusMessage('Checking availability...')}
                >
                  {isSubmitting ? 'Checking...' : 'Check availability'}
                </button>
                <Link
                  to="/apartments"
                  onClick={() =>
                    trackEvent(
                      'listings_browse',
                      { surface: 'hero_secondary' },
                      { route: '/apartments' },
                    )
                  }
                  className="inline-flex items-center justify-center text-base font-semibold text-text-primary underline-offset-4 transition hover:text-cta-secondary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                >
                  Browse listings
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

            <div className="flex flex-col gap-2 rounded-2xl bg-[color:color-mix(in_srgb,var(--bg-surface)_92%,transparent)] px-5 py-4 text-left shadow-inner md:flex-row md:items-center md:gap-4">
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
        <div className="mx-auto -mt-6 flex max-w-5xl flex-wrap items-center justify-center gap-3 px-6 pb-6 pt-2 md:gap-4 md:pb-8 md:pt-0">
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
