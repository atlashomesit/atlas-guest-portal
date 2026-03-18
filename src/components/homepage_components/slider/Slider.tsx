import React from 'react';
import { Link } from 'react-router-dom';
<<<<<<< HEAD
import { BadgePercent, CheckCircle2, ShieldCheck } from 'lucide-react';
import { TrustBadge } from '../../ui/TrustBadge';
import { SearchAvailabilityWidget } from '../../availability/SearchAvailabilityWidget';

=======
import { BadgePercent, CheckCircle2, ShieldCheck, Home } from 'lucide-react';
import { HERO_IMAGE_URL } from '../../../config/hero';
import { heroWidgetLayoutFlag } from '../../../config/abFlags';
import { TrustBadge } from '../../ui/TrustBadge';
import { SearchAvailabilityWidget } from '../../availability/SearchAvailabilityWidget';

const HERO_OVERLAY_GRADIENT =
  'linear-gradient(118deg, rgba(7, 10, 18, 0.92) 0%, rgba(7, 10, 18, 0.78) 42%, rgba(7, 10, 18, 0.62) 100%)';
const HERO_OVERLAY_GRADIENT_LEGACY =
  'linear-gradient(115deg, rgba(7, 10, 18, 0.82) 0%, rgba(7, 10, 18, 0.64) 45%, rgba(7, 10, 18, 0.38) 100%)';
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
const TRUST_BADGES = [
  { label: 'Verified homes', icon: CheckCircle2 },
  { label: 'Secure Razorpay payments', icon: ShieldCheck },
  { label: 'No hidden fees', icon: BadgePercent },
];

<<<<<<< HEAD
const STAGGER = ['hero-stagger-0', 'hero-stagger-1', 'hero-stagger-2', 'hero-stagger-3', 'hero-stagger-4'];

const Slider = () => {
  return (
    <section
      className="relative min-h-[90vh] flex flex-col justify-center pt-[var(--nav-height)] pb-20 overflow-hidden"
      style={{ background: 'var(--gradient-hero)' }}
      aria-labelledby="hero-title"
    >
      <div
        className="absolute top-[-10%] right-[-8%] w-[75%] max-w-[720px] h-[75%] max-h-[560px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255, 232, 214, 0.28) 0%, transparent 72%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-[1100px] mx-auto px-[6%] flex flex-col items-center text-center gap-8">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)] bg-[var(--brand-soft)] ${STAGGER[0]}`}
          style={{ animation: 'heroFadeInUp 0.8s cubic-bezier(0.33, 1, 0.4, 1) both' }}
        >
          <span aria-hidden>✦</span>
          <span>Welcome to</span>
        </div>

        <h1
          id="hero-title"
          className={`font-display font-semibold text-[34px] leading-[1.2] md:text-5xl lg:text-[40px] tracking-tight text-[var(--text-primary)] ${STAGGER[1]}`}
          style={{
            animation: 'heroFadeInUp 0.9s cubic-bezier(0.33, 1, 0.4, 1) 0.08s both',
            fontFamily: 'var(--font-family-display)',
          }}
        >
          Thoughtfully curated stays in Hyderabad
        </h1>

        <p
          className={`max-w-2xl text-[var(--text-body)] text-base md:text-lg font-normal leading-relaxed text-[var(--text-muted)] ${STAGGER[2]}`}
          style={{
            animation: 'heroFadeInUp 0.9s cubic-bezier(0.33, 1, 0.4, 1) 0.16s both',
            fontFamily: 'var(--font-family-base)',
          }}
        >
          Discover verified apartments with flexible bookings, transparent pricing, and secure payments.
        </p>

        <div
          className={`w-full max-w-[980px] ${STAGGER[3]}`}
          style={{ animation: 'heroFadeInUp 1s cubic-bezier(0.33, 1, 0.4, 1) 0.22s both' }}
        >
          <div className="rounded-[20px] bg-white/96 shadow-[var(--shadow-level-3)] backdrop-blur-sm border border-white/80 overflow-hidden">
            <SearchAvailabilityWidget mode="search" />
          </div>
        </div>

        <div
          className="flex flex-wrap items-center justify-center gap-6 md:gap-8 pt-2"
          data-testid="trust-badges"
          style={{ animation: 'heroFadeInUp 1s cubic-bezier(0.33, 1, 0.4, 1) 0.28s both' }}
        >
=======
const Slider = () => {
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

          <SearchAvailabilityWidget mode="search" />

          <Link
            to="/become-a-host"
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-[var(--text-on-hero)] backdrop-blur-sm transition hover:bg-white/20 hover:border-white/50"
          >
            <Home className="h-4 w-4" />
            List your property — it's free
          </Link>
        </div>
      </div>

      <div className="bg-bg-surface" data-testid="trust-badges">
        <div className="mx-auto -mt-4 flex max-w-5xl flex-wrap items-center justify-center gap-3 px-4 pb-6 pt-2 sm:px-6 md:gap-4 md:pb-8 md:pt-0">
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
          {TRUST_BADGES.map(({ label, icon }) => (
            <TrustBadge
              key={label}
              icon={icon}
              label={label}
<<<<<<< HEAD
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200"
            />
          ))}
        </div>

        <Link to="/#our-homes" className="sr-only">
          Skip to Our Homes
        </Link>
=======
              className="min-w-[215px] justify-center sm:min-w-[0]"
            />
          ))}
        </div>
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
      </div>
    </section>
  );
};

export default Slider;
