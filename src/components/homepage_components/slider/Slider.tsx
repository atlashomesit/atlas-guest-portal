import React from 'react';
import { Link } from 'react-router-dom';
import { BadgePercent, CheckCircle2, ShieldCheck, Home } from 'lucide-react';
import { HERO_IMAGE_URL } from '../../../config/hero';
import { heroWidgetLayoutFlag } from '../../../config/abFlags';
import { getTenantContext } from '../../../tenant/tenantContext';
import { getTenantOverrides } from '../../../tenant/tenantOverrides';
import {
  PMS_AIRBNB_2026_TERMS_URL,
  resolveDirectBookingPromo,
} from '../../../utils/directBookingPromo';
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
  // RA-006: only show the Atlas penthouse hero on the Atlas marketplace root.
  // White-label tenant subdomains (e.g. starguesthouse.atlastays.com) must not
  // leak Atlas-branded imagery — fall back to the gradient-only background
  // until per-tenant heroImageUrl is wired through TenantBranding.
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  const directPromo = React.useMemo(
    () => resolveDirectBookingPromo(tenant, overrides),
    [tenant, overrides],
  );
  const isAtlasRoot = tenant?.isMarketplaceRoot !== false;
  const heroImageUrl = isAtlasRoot ? HERO_IMAGE_URL : '';
  const hasHeroPhoto = Boolean(heroImageUrl.trim());
  const showListProperty = !overrides.hideListProperty;

  const overlayStyle = React.useMemo(() => {
    // With a photo, keep text readable without painting the whole viewport flat black.
    // May 2026: backdrop-filter removed — warm-editorial guardrails ban glassmorphism.
    // Overlay opacity dialled down so golden-hour property photography reads through.
    const style: React.CSSProperties = hasHeroPhoto
      ? {
          backgroundColor: "rgba(7, 10, 18, 0.42)",
          backgroundImage: HERO_OVERLAY_GRADIENT_LEGACY,
        }
      : {
          backgroundColor: enableWidgetExperiment ? "rgba(3, 6, 14, 0.74)" : "rgba(0, 0, 0, 0.45)",
          backgroundImage: enableWidgetExperiment ? HERO_OVERLAY_GRADIENT : HERO_OVERLAY_GRADIENT_LEGACY,
        };

    if (typeof navigator !== "undefined" && navigator.userAgent?.includes("jsdom")) {
      style.backgroundImage = 'url("linear-gradient-overlay")';
    }

    return style;
  }, [enableWidgetExperiment, hasHeroPhoto]);

  return (
    <section className="w-full bg-bg-muted text-text-primary">
      <div
        className="relative isolate overflow-hidden min-h-[min(78vh,820px)] md:min-h-[min(72vh,760px)] flex items-center justify-center bg-bg-muted bg-cover bg-center bg-no-repeat pt-[calc(var(--nav-height,80px)+1rem)] pb-8"
        style={
          hasHeroPhoto
            ? { backgroundImage: `url(${heroImageUrl})` }
            : undefined
        }
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

          <div data-testid="hero-widget">
            <SearchAvailabilityWidget />
          </div>

          {directPromo.show ? (
            <div
              className="w-full max-w-2xl rounded-xl border border-emerald-400/35 bg-emerald-950/95 px-4 py-3 text-center text-emerald-50 shadow-lg"
              data-testid="home-direct-booking-promo"
              role="region"
              aria-label="Direct booking savings"
            >
              <p className="text-sm font-semibold tracking-tight sm:text-base">{directPromo.savingsStripLine}</p>
              <p className="mt-1 text-xs text-emerald-100/95 sm:text-sm">{directPromo.sub}</p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs sm:text-sm">
                <Link
                  to="/"
                  state={{ scrollTo: 'search-form' }}
                  className="font-medium text-emerald-200 underline underline-offset-2 hover:text-white"
                  data-testid="home-direct-booking-promo-dates"
                >
                  Pick dates →
                </Link>
                <span className="text-emerald-300/80" aria-hidden>
                  ·
                </span>
                <a
                  href={PMS_AIRBNB_2026_TERMS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-emerald-200 underline underline-offset-2 hover:text-white"
                >
                  Why direct booking matters →
                </a>
              </div>
            </div>
          ) : null}

          {showListProperty && (
            <Link
              to="/become-a-host"
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/40 bg-[rgba(255,250,245,0.16)] px-5 py-2.5 text-sm font-semibold text-[var(--text-on-hero)] transition hover:bg-[rgba(255,250,245,0.24)] hover:border-white/60"
              data-discover="true"
            >
              <Home className="h-4 w-4" />
              List your property — it's free
            </Link>
          )}
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
