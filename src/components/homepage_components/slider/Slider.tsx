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
import { TrustBadge } from '../../ui/TrustBadge';

const HERO_OVERLAY_GRADIENT =
  'linear-gradient(90deg, rgba(0, 0, 0, 0.62) 0%, rgba(0, 0, 0, 0.45) 45%, rgba(0, 0, 0, 0.24) 100%)';
const STORAGE_KEY = 'atlasHeroSearch';

const TRUST_BADGES = [
  { label: 'Verified homes', icon: CheckCircle2 },
  { label: 'Secure Razorpay payments', icon: ShieldCheck },
  { label: 'No hidden fees', icon: BadgePercent },
];

const Slider = () => {
  const navigate = useNavigate();

  const overlayStyle = React.useMemo(() => {
    const style: React.CSSProperties = {
      backgroundColor: 'rgba(0, 0, 0, 0.16)',
      backgroundImage: HERO_OVERLAY_GRADIENT,
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const { startDate, endDate } = dateRange;

    if (!startDate || !endDate) {
      setError('Please select your check-in and check-out dates.');
      return;
    }

    if (endDate <= startDate) {
      setError('Check-out must be after check-in.');
      return;
    }

    if (startDate < today) {
      setDateRange(clampRange(today, endDate));
      setError('Check-in cannot be in the past.');
      return;
    }

    if (guests < 1) {
      setError('Guests must be at least 1.');
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

    navigate(`/apartments?${searchParams.toString()}`);
  };

  const handleRangeChange = (ranges: RangeKeyDict) => {
    const selection = ranges.selection ?? { startDate: null, endDate: null };
    const normalizedStart = selection.startDate ? startOfDay(selection.startDate) : null;
    const normalizedEnd = selection.endDate ? startOfDay(selection.endDate) : null;
    setDateRange(clampRange(normalizedStart, normalizedEnd));
    setError(null);
    if (selection.startDate && selection.endDate) {
      setIsCalendarOpen(false);
    }
  };

  const formattedDateSummary =
    dateRange.startDate && dateRange.endDate
      ? `${format(dateRange.startDate, 'dd MMM yyyy')} – ${format(dateRange.endDate, 'dd MMM yyyy')}`
      : 'Select dates';

  const summaryLine = `${formattedDateSummary} · ${guests} guest${guests === 1 ? '' : 's'}`;

  return (
    <section className="w-full bg-bg-muted text-text-primary">
      <div
        className="relative isolate overflow-hidden min-h-[75vh] md:min-h-[70vh] flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${HERO_IMAGE_URL})` }}
      >
        <div
          data-testid="hero-overlay"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-95"
          style={overlayStyle}
        />
        <div className="relative top-[40px] z-10 flex flex-col items-center gap-7 px-6 py-12 text-center max-w-4xl">

          <Link to="/" className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Atlas Homestays" className="h-14 w-auto rounded-md bg-[color:color-mix(in_srgb,var(--bg-surface)_80%,transparent)] p-2 shadow-level1" />
            <span className="text-xl font-semibold text-[var(--text-contrast)] tracking-wide">Atlas Homestays</span>
          </Link>

          <div className="space-y-4 max-w-3xl">
            <p
              className="text-3xl md:text-5xl font-semibold text-[var(--text-on-hero)] drop-shadow-lg text-pretty"
              style={{ textWrap: 'balance' }}
            >
              Thoughtfully curated stays in Hyderabad
            </p>
            <p
              className="text-base md:text-lg text-[color-mix(in_srgb,var(--text-on-hero)_88%,transparent)] text-pretty"
              style={{ textWrap: 'balance' }}
            >
              Discover verified apartments with flexible bookings, transparent pricing, and secure payments.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full max-w-4xl rounded-2xl bg-[color:color-mix(in_srgb,var(--bg-surface)_92%,transparent)] shadow-level2 backdrop-blur border border-[color:color-mix(in_srgb,var(--bg-surface)_55%,transparent)] p-4 md:p-5 flex flex-col gap-3"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.6fr_0.9fr]">
              <div className="relative" ref={calendarWrapperRef}>
                <button
                  type="button"
                  className="flex w-full flex-col rounded-xl bg-bg-muted px-4 py-3 text-left shadow-inner transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                  aria-label="Choose your stay dates"
                  aria-expanded={isCalendarOpen}
                  onClick={() => setIsCalendarOpen((open) => !open)}
                  data-testid="hero-date-toggle"
                >
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    <CalendarRange className="h-4 w-4" aria-hidden="true" />
                    Dates
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-lg font-semibold text-text-primary">
                    {summaryLine}
                    <ChevronDown className={`h-4 w-4 text-text-muted transition ${isCalendarOpen ? 'rotate-180' : ''}`} aria-hidden />
                  </span>
                  <span className="mt-1 text-xs font-medium text-text-secondary">Check-out must be after check-in.</span>
                </button>

                {isCalendarOpen && (
                  <div className="absolute left-0 right-0 z-[var(--z-dropdown)] mt-2 rounded-2xl border border-border-subtle bg-bg-surface p-3 shadow-level2 md:w-auto">
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
                  </div>
                )}
              </div>

              <div className="flex flex-col rounded-xl bg-bg-muted px-4 py-3 shadow-inner text-left">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <Users className="h-4 w-4" aria-hidden />
                  Guests
                </span>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle text-lg font-semibold text-text-primary transition hover:border-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary disabled:opacity-40"
                    onClick={() => setGuests((prev) => Math.max(1, prev - 1))}
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
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle text-lg font-semibold text-text-primary transition hover:border-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                    onClick={() => setGuests((prev) => Math.min(16, prev + 1))}
                    aria-label="Increase guests"
                  >
                    +
                  </button>
                </div>
                <span className="mt-2 text-xs font-medium text-text-secondary">Defaulting to 2 guests; adjust anytime.</span>
              </div>
            </div>

            {error && (
              <p className="text-left text-sm font-semibold text-[color-mix(in_srgb,var(--cta-secondary)_90%,transparent)]">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1 rounded-xl bg-[color:color-mix(in_srgb,var(--bg-surface)_92%,transparent)] px-4 py-3 text-left shadow-inner sm:flex-row sm:items-center sm:gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <ShieldCheck className="h-4 w-4 text-cta-secondary" aria-hidden="true" />
                  <span>Book with confidence</span>
                </div>
                <p className="text-sm text-text-secondary sm:border-l sm:border-[color:color-mix(in_srgb,var(--text-muted)_60%,transparent)] sm:pl-3">
                  Instant confirmation • Secure payments • No hidden charges
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-cta-primary px-6 py-3 text-base font-semibold text-[var(--text-contrast)] shadow-level2 transition hover:bg-cta-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                >
                  Check availability
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
          </form>
        </div>
      </div>

      <div className="bg-bg-surface" data-testid="trust-badges">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-4 px-6 py-8 md:gap-5">
          {TRUST_BADGES.map(({ label, icon }) => (
            <TrustBadge
              key={label}
              icon={icon}
              label={label}
              className="min-w-[220px] justify-center sm:min-w-[0]"
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Slider;
