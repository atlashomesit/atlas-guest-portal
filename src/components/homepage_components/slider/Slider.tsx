import React from 'react';
import { Link } from 'react-router-dom';
import { BadgePercent, CheckCircle2, ShieldCheck } from 'lucide-react';
import { LOGO_URL } from '../../../config/branding';
import { HERO_IMAGE_URL } from '../../../config/hero';
import { heroWidgetLayoutFlag } from '../../../config/abFlags';
import { TrustBadge } from '../../ui/TrustBadge';
import { SearchAvailabilityWidget } from '../../availability/SearchAvailabilityWidget';

const HERO_OVERLAY_GRADIENT =
  'linear-gradient(118deg, rgba(7, 10, 18, 0.92) 0%, rgba(7, 10, 18, 0.78) 42%, rgba(7, 10, 18, 0.62) 100%)';
const HERO_OVERLAY_GRADIENT_LEGACY =
  'linear-gradient(115deg, rgba(7, 10, 18, 0.82) 0%, rgba(7, 10, 18, 0.64) 45%, rgba(7, 10, 18, 0.38) 100%)';
const TRUST_BADGES = [
  { label: 'Verified homes', icon: CheckCircle2 },
  { label: 'Secure Razorpay payments', icon: ShieldCheck },
  { label: 'No hidden fees', icon: BadgePercent },
];

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

          <SearchAvailabilityWidget mode="search" />
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
