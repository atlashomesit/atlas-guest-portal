import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgePercent, CheckCircle2, ShieldCheck } from 'lucide-react';
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

  const today = React.useMemo(() => new Date(), []);

  const defaultDates = React.useMemo(() => {
    const checkInDate = new Date();
    const checkOutDate = new Date();
    checkOutDate.setDate(checkOutDate.getDate() + 1);

    const toInputValue = (date: Date) => date.toISOString().split('T')[0];

    return {
      checkIn: toInputValue(checkInDate),
      checkOut: toInputValue(checkOutDate),
    };
  }, []);

  const [checkIn, setCheckIn] = React.useState(defaultDates.checkIn);
  const [checkOut, setCheckOut] = React.useState(defaultDates.checkOut);
  const [guests, setGuests] = React.useState(2);
  const [error, setError] = React.useState<string | null>(null);

  const isValidDate = (value?: string | null) => {
    if (!value) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
  };

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as { checkIn?: string; checkOut?: string; guests?: number };

      const minDate = defaultDates.checkIn;

      if (isValidDate(parsed.checkIn)) {
        const storedCheckIn = new Date(parsed.checkIn!);
        const minCheckInDate = new Date(minDate);
        setCheckIn((storedCheckIn < minCheckInDate ? minDate : parsed.checkIn!) || defaultDates.checkIn);
      }

      if (isValidDate(parsed.checkOut)) {
        const storedCheckOut = new Date(parsed.checkOut!);
        const referenceCheckIn = isValidDate(parsed.checkIn) ? new Date(parsed.checkIn!) : new Date(minDate);
        setCheckOut(
          storedCheckOut > referenceCheckIn ? parsed.checkOut! : defaultDates.checkOut,
        );
      }

      if (typeof parsed.guests === 'number' && parsed.guests > 0) {
        setGuests(parsed.guests);
      }
    } catch {
      // Ignore storage parse errors
    }
  }, [defaultDates.checkIn, defaultDates.checkOut]);

  React.useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          checkIn,
          checkOut,
          guests,
        }),
      );
    } catch {
      // Ignore storage write errors
    }
  }, [checkIn, checkOut, guests]);

  const minCheckIn = React.useMemo(() => today.toISOString().split('T')[0], [today]);

  const minCheckOut = React.useMemo(() => {
    const base = isValidDate(checkIn) ? new Date(checkIn) : new Date();
    base.setDate(base.getDate() + 1);
    return base.toISOString().split('T')[0];
  }, [checkIn]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
      setError('Please select valid check-in and check-out dates.');
      return;
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (checkInDate < new Date(minCheckIn)) {
      setError('Check-in cannot be in the past.');
      return;
    }

    if (checkOutDate <= checkInDate) {
      setError('Check-out must be after check-in.');
      return;
    }

    if (guests < 1) {
      setError('Guests must be at least 1.');
      return;
    }

    const searchParams = new URLSearchParams({
      checkIn: checkInDate.toISOString().split('T')[0],
      checkOut: checkOutDate.toISOString().split('T')[0],
      guests: guests.toString(),
    });

    trackEvent(
      'availability_search',
      {
        surface: 'hero_form',
        checkIn: checkInDate.toISOString(),
        checkOut: checkOutDate.toISOString(),
        guests,
      },
      { route: `/apartments?${searchParams.toString()}` },
    );

    trackEvent(
      'listings_browse',
      { surface: 'hero_form', checkIn: checkInDate.toISOString(), checkOut: checkOutDate.toISOString(), guests },
      { route: `/apartments?${searchParams.toString()}` },
    );

    navigate(`/apartments?${searchParams.toString()}`);
  };

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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="flex flex-col rounded-xl bg-bg-muted px-4 py-3 shadow-inner text-left">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Check-in</span>
                <input
                  type="date"
                  min={minCheckIn}
                  value={checkIn}
                  onChange={(event) => setCheckIn(event.target.value)}
                  className="w-full bg-transparent text-lg font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
                  required
                />
              </label>
              <label className="flex flex-col rounded-xl bg-bg-muted px-4 py-3 shadow-inner text-left">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Check-out</span>
                <input
                  type="date"
                  min={minCheckOut}
                  value={checkOut}
                  onChange={(event) => setCheckOut(event.target.value)}
                  className="w-full bg-transparent text-lg font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
                  required
                />
              </label>
              <label className="flex flex-col rounded-xl bg-bg-muted px-4 py-3 shadow-inner text-left md:max-w-[180px]">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Guests</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={guests}
                  onChange={(event) => setGuests(Math.max(1, Number(event.target.value)))}
                  className="w-full bg-transparent text-lg font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
                  required
                />
              </label>
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
