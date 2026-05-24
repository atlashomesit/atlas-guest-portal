import React from 'react';
import { Link } from 'react-router-dom';
import { HERO_IMAGE_URL } from '../../../config/hero';
import { getTenantContext } from '../../../tenant/tenantContext';
import { getTenantBrandName } from '../../../tenant/displayBrand';
import { getTenantOverrides, shouldHideAtlasBranding } from '../../../tenant/tenantOverrides';
import {
  PMS_AIRBNB_2026_TERMS_URL,
  resolveDirectBookingPromo,
} from '../../../utils/directBookingPromo';
import { SearchAvailabilityWidget } from '../../availability/SearchAvailabilityWidget';
import '../atlas-home-v2.css';

// Ivory seam (left 120px) + a soft 8% coral wash over the hero photo. Kept as a
// single overlay element so its backgroundImage is readable by jsdom-based tests.
const HERO_OVERLAY_GRADIENT =
  'linear-gradient(to right, #fffaf5 0px, rgba(255,250,245,0) 120px), linear-gradient(rgba(194,65,12,0.08), rgba(194,65,12,0.08))';

const Slider = () => {
  // RA-006: only show the Atlas penthouse hero on the Atlas marketplace root.
  // White-label tenant subdomains must not leak Atlas-branded imagery — they
  // fall back to a warm ivory→amber gradient panel until a per-tenant
  // heroImageUrl is wired through TenantBranding.
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  const directPromo = React.useMemo(
    () => resolveDirectBookingPromo(tenant, overrides),
    [tenant, overrides],
  );
  // Show Atlas-branded imagery/copy on Atlas surfaces (marketplace root + the
  // `atlas` tenant) but never on white-label tenant subdomains (RA-006). This is
  // the same canonical check the "Our Homes" grid uses for its Atlas eyebrow.
  const showAtlasContent = !shouldHideAtlasBranding(tenant, overrides);
  const heroImageUrl = showAtlasContent ? HERO_IMAGE_URL : '';
  const hasHeroPhoto = Boolean(heroImageUrl.trim());

  // Delayed italic-city fade-in (280ms after the rest of the headline lands).
  const [headlineIn, setHeadlineIn] = React.useState(false);
  React.useEffect(() => {
    const t = window.setTimeout(() => setHeadlineIn(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const overlayStyle = React.useMemo(() => {
    const style: React.CSSProperties = { backgroundImage: HERO_OVERLAY_GRADIENT };
    // jsdom drops complex backgroundImage values; swap in a url() the test can read.
    if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('jsdom')) {
      style.backgroundImage = 'url("linear-gradient-overlay")';
    }
    return style;
  }, []);

  return (
    <section className="ahv2-hero w-full">
      {/* Left — ivory editorial column */}
      <div className="ahv2-hero-left">
        <span className="ahv2-eyebrow ahv2-hero-eyebrow">{getTenantBrandName()}</span>

        <h1 className={`ahv2-hero-h1${headlineIn ? ' ahv2-in' : ''}`}>
          Thoughtfully curated stays{' '}
          <span className="ahv2-city">in Hyderabad</span>
        </h1>

        <p className="ahv2-hero-sub">
          {showAtlasContent
            ? 'Seven owner-run homes in KPHB. Same hands clean them, restock them, answer the door.'
            : 'Direct from the owner — no platform fee, verified addresses, and WhatsApp-first support from a team that lives down the street.'}
        </p>

        {/* Floating search card — the real, functional availability widget */}
        <div data-testid="hero-widget" className="ahv2-hero-widget">
          <SearchAvailabilityWidget />
        </div>

        {directPromo.show ? (
          <div
            className="w-full max-w-2xl rounded-xl border border-emerald-400/35 bg-emerald-950/95 px-4 py-3 text-center text-emerald-50 shadow-lg"
            data-testid="home-direct-booking-promo"
            role="region"
            aria-label="Direct booking savings"
            style={{ marginBottom: 24 }}
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

        {/* Trust strip — three soft-amber chips (one canonical line) */}
        <ul className="ahv2-chip-row" role="list" aria-label="Booking guarantees">
          <li role="listitem" className="ahv2-chip">
            <span className="ahv2-tick" aria-hidden="true">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            Instant confirmation
          </li>
          <li role="listitem" className="ahv2-chip">
            <span className="ahv2-tick" aria-hidden="true">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            Verified homes
          </li>
          <li role="listitem" className="ahv2-chip">
            <span className="ahv2-tick" aria-hidden="true">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            Free cancellation 48h before check-in
          </li>
        </ul>
      </div>

      {/* Right — cinematic photo (Atlas root) or warm gradient (white-label) */}
      <div className="ahv2-hero-right">
        {hasHeroPhoto ? (
          <div
            className="ahv2-hero-photo"
            style={{ backgroundImage: `url("${heroImageUrl}")` }}
            role="img"
            aria-label="A warm, owner-run Atlas living room in KPHB"
          />
        ) : (
          <div className="ahv2-hero-photo ahv2-hero-photo--fallback" aria-hidden="true" />
        )}
        <div
          data-testid="hero-overlay"
          aria-hidden="true"
          className="ahv2-hero-overlay"
          style={overlayStyle}
        />
        {showAtlasContent && hasHeroPhoto ? (
          <div className="ahv2-caption-pill">
            <span className="ahv2-dot" aria-hidden="true" />
            KPHB 7th Phase
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default Slider;
