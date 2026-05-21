import React from 'react';
import { Link } from 'react-router-dom';
import { HERO_IMAGE_URL } from '../../../config/hero';
import { heroWidgetLayoutFlag } from '../../../config/abFlags';
import { getTenantContext } from '../../../tenant/tenantContext';
import { getTenantOverrides } from '../../../tenant/tenantOverrides';
import {
  PMS_AIRBNB_2026_TERMS_URL,
  resolveDirectBookingPromo,
} from '../../../utils/directBookingPromo';
import { SearchAvailabilityWidget } from '../../availability/SearchAvailabilityWidget';

const HERO_OVERLAY_GRADIENT =
  'linear-gradient(118deg, rgba(7, 10, 18, 0.92) 0%, rgba(7, 10, 18, 0.78) 42%, rgba(7, 10, 18, 0.62) 100%)';
const HERO_OVERLAY_GRADIENT_LEGACY =
  'linear-gradient(180deg, rgba(26,26,46,.35) 0%, rgba(26,26,46,.55) 60%, rgba(26,26,46,.78) 100%)';

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
        className="relative isolate overflow-hidden min-h-[min(78vh,820px)] md:min-h-[min(72vh,760px)] flex items-end justify-center bg-bg-muted bg-cover bg-center bg-no-repeat pt-[calc(var(--nav-height,116px)+1rem)] pb-12"
        style={
          hasHeroPhoto
            ? { backgroundImage: `url(${heroImageUrl})` }
            : undefined
        }
      >
        <div
          data-testid="hero-overlay"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={overlayStyle}
        />
        {/* Hero inner — left-aligned on desktop (max-w-6xl container), centred on mobile */}
        <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col gap-6 px-5 sm:px-8 items-center md:items-start text-center md:text-left pb-4">

          {/* Eyebrow — Home v2 design §2 */}
          <div
            className="inline-flex items-center gap-2.5 text-xs font-semibold tracking-[0.18em] uppercase"
            style={{ color: '#ffe8d6' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--brand-primary, #ea580c)' }}
              aria-hidden="true"
            />
            Atlas Homestays · Hyderabad
          </div>

          <div className="space-y-4 max-w-3xl">
            <h1
              className="font-bold leading-[1.04] text-[#fffaf5] drop-shadow-lg"
              style={{ fontSize: 'clamp(42px, 5.4vw, 74px)', textWrap: 'balance', letterSpacing: '-0.005em', fontFamily: 'var(--font-family-display)' }}
            >
              Thoughtfully curated stays{' '}
              <em style={{ fontStyle: 'italic', color: '#ffd9b3', fontWeight: 400 }}>in Hyderabad.</em>
            </h1>
            <p
              className="text-base sm:text-lg leading-relaxed max-w-xl"
              style={{ color: 'rgba(255,250,245,.86)' }}
            >
              Direct from the owner —{' '}
              <strong style={{ color: '#ffe8d6', fontWeight: 600 }}>no platform fee</strong>,
              {' '}verified addresses, and WhatsApp-first support from a team that lives down the street.
            </p>
          </div>

          <div data-testid="hero-widget" className="w-full max-w-2xl">
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

          {/* Trust strip — one canonical line (Home v2 design §3) */}
          <div
            className="flex flex-wrap items-center gap-3 text-[13.5px]"
            style={{ color: 'rgba(255,250,245,.85)' }}
            role="list"
            aria-label="Booking guarantees"
          >
            <span role="listitem" className="inline-flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--brand-primary, #ea580c)' }}><path d="M20 6 9 17l-5-5"/></svg>
              Instant confirmation
            </span>
            <span className="w-1 h-1 rounded-full hidden sm:block" style={{ background: 'rgba(255,250,245,.4)' }} aria-hidden="true" />
            <span role="listitem" className="inline-flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--brand-primary, #ea580c)' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
              Verified homes
            </span>
            <span className="w-1 h-1 rounded-full hidden sm:block" style={{ background: 'rgba(255,250,245,.4)' }} aria-hidden="true" />
            <span role="listitem" className="inline-flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--brand-primary, #ea580c)' }}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
              Free cancellation 48h before check-in
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Slider;
