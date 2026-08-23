import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation, matchPath } from 'react-router-dom';
import './navbar.css';
import './mobile-search.css';
import MobileSearchPill from './MobileSearchPill';

import { primaryNav, ctaNav, tripsMenuNav } from '../../../config/navigation';
import { LOGO_URL, isWordmarkLogo } from '../../../config/branding';
import { getTenantContext } from '../../../tenant/tenantContext';
import { getTenantBrandName } from '../../../tenant/displayBrand';
import { getTenantOverrides, shouldShowHostAcquisitionCtas } from '../../../tenant/tenantOverrides';
import { getAdminPortalLoginUrl } from '../../../config/adminPortal';
import { formatDisplayNumber, getTelLink } from '../../../config/contact';
import { trackEvent } from '../../../utils/analytics';
import { getFavoriteIds } from '../../../utils/guestHistory';
import { useBooking } from '../../../contexts/BookingContext';
import { useTranslation } from '../../../hooks/useTranslation';
import { LANGUAGE_SWITCHER_ENABLED } from '../../../i18n/i18n'; // TASK-4517

const Navbar = () => {
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  // Repo-shipped per-tenant artwork (overrides.logoUrl) wins over the API logo;
  // both fall back to the brand-neutral placeholder for logo-less tenants.
  const logoSrc = overrides.logoUrl ?? tenant?.logoUrl ?? LOGO_URL;
  // RA-006 §3.5: prefer tenant name everywhere; only fall back to "Home" on the Atlas root.
  const brandName = getTenantBrandName();
  const showLogo = !overrides.hideLogo;
  const showHostAcquisition = shouldShowHostAcquisitionCtas(tenant, overrides);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [tripsMenuOpen, setTripsMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [ctaStatus, setCtaStatus] = useState<'idle' | 'navigating' | 'scrolling'>('idle');
  const [savedCount, setSavedCount] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const { booking } = useBooking();
  const { language, changeLanguage, availableLanguages, getLanguageName } = useTranslation();

  const telLink = getTelLink();

  /* Saved count badge (TASK-1458) — updates on navigation + same-tab toggles */
  useEffect(() => {
    const syncSaved = () => setSavedCount(getFavoriteIds().length);
    syncSaved();
    window.addEventListener('storage', syncSaved);
    window.addEventListener('atlas-favorites-changed', syncSaved);
    return () => {
      window.removeEventListener('storage', syncSaved);
      window.removeEventListener('atlas-favorites-changed', syncSaved);
    };
  }, [location.pathname]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link ${isActive ? 'text-white' : ''}`;

  const closeMobile = () => {
    setIsMenuOpen(false);
  };

  /* =========================
     ✅ FINAL BOOK NOW HANDLER
  ========================= */
  const handleBookNow = () => {
    const propertyMatch =
      matchPath('/homes/:propertySlug/:unitSlug', location.pathname) ??
      matchPath('/homes/:roomNo', location.pathname) ??
      matchPath('/property_details/:id', location.pathname) ??
      matchPath('/properties/:id', location.pathname);
    const routeParams = propertyMatch?.params as
      | { unitSlug?: string; roomNo?: string; id?: string }
      | undefined;
    const propertyIdFromRoute =
      routeParams?.unitSlug ?? routeParams?.roomNo ?? routeParams?.id ?? null;
    const isPropertyDetailsRoute = Boolean(propertyMatch);
    const bookingTarget = isPropertyDetailsRoute ? 'booking-form' : 'search';
    const bookingSurface = isPropertyDetailsRoute ? 'property_details' : 'navbar';

    setCtaStatus(isPropertyDetailsRoute ? 'scrolling' : 'navigating');

    const bookingState = {
      propertyId: booking.propertyId ?? propertyIdFromRoute ?? undefined,
      checkIn: booking.checkIn ?? undefined,
      checkOut: booking.checkOut ?? undefined,
      guests: booking.guests,
      // TASK-3938: forward the guest-count breakdown so SearchAvailabilityWidget preserves it
      // instead of re-deriving a 60/40 adults/children split from the total.
      adults: booking.adults ?? undefined,
      children: booking.children ?? undefined,
      infants: booking.infants ?? undefined,
      pets: booking.pets ?? undefined,
    };

    const destination = isPropertyDetailsRoute ? `${location.pathname}#${bookingTarget}` : ctaNav.to;

    trackEvent(
      'cta_book_now_clicked',
      {
        source: 'header',
        target: bookingTarget,
        surface: bookingSurface,
        propertyId: bookingState.propertyId,
        checkIn: bookingState.checkIn,
        checkOut: bookingState.checkOut,
        guests: booking.guests,
      },
      { route: destination },
    );

    if (isPropertyDetailsRoute) {
      const bookingForm = document.getElementById('booking-form') ?? document.querySelector('[data-testid="guest-booking-form"]');
      if (bookingForm) {
        bookingForm.scrollIntoView({ behavior: 'smooth', block: 'start' });

        if (bookingForm instanceof HTMLElement) {
          const hadTabIndex = bookingForm.hasAttribute('tabindex');
          if (!hadTabIndex) bookingForm.setAttribute('tabindex', '-1');
          bookingForm.focus({ preventScroll: true });
          if (!hadTabIndex) bookingForm.removeAttribute('tabindex');
        }

        window.setTimeout(() => setCtaStatus('idle'), 1200);
        closeMobile();
        return;
      }
    }

    navigate(ctaNav.to, {
      state: { bookingPrefill: bookingState },
    });

    closeMobile();
  };

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

  const visibleNavItems = primaryNav.filter((item) => !item.hidden && item.label !== 'Trips');

  useEffect(() => {
    setCtaStatus('idle');
  }, [location.pathname]);

  return (
    <header className="navbar-container" id="navbar_container">
      {/* Slim utility bar — Home v2 design §1: dark strip above main header */}
      <div className="util-bar" aria-hidden="false">
        <div className="util-bar-inner">
          <div className="util-bar-left">
            {showHostAcquisition ? (
              <>
                <a href="/become-a-host" data-testid="navbar-list-property">
                  List your property
                </a>
                <a
                  href={getAdminPortalLoginUrl()}
                  rel="noopener noreferrer"
                  data-testid="navbar-host-login"
                >
                  Host login
                </a>
              </>
            ) : null}
          </div>
          <div className="util-bar-right">
            <a className="util-bar-phone" href={telLink}>{formatDisplayNumber()}</a>
            <span className="util-bar-sep" aria-hidden="true" />
            {/* TASK-4018: Language switcher — TASK-8103: enabled for all 7 locales (English fallback for mr/bn/ta/kn) */}
            {LANGUAGE_SWITCHER_ENABLED && (
              <div className="relative">
                <button
                  type="button"
                  className="util-bar-locale lang-switcher"
                  onClick={() => setLangMenuOpen(!langMenuOpen)}
                  onBlur={() => window.setTimeout(() => setLangMenuOpen(false), 150)}
                  aria-label="Change language"
                  aria-expanded={langMenuOpen}
                >
                  {language.toUpperCase()}
                </button>
                {langMenuOpen && (
                  <div
                    className="absolute right-0 top-full z-50 mt-1 min-w-[8rem] rounded-lg border border-border-subtle bg-bg-surface shadow-lg"
                    role="menu"
                  >
                    {availableLanguages.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        role="menuitem"
                        className={`block w-full text-left px-4 py-2 text-sm ${
                          language === lang
                            ? 'bg-brand-primary/10 font-semibold text-brand-primary'
                            : 'text-text-primary hover:bg-bg-muted'
                        }`}
                        onClick={() => {
                          changeLanguage(lang);
                          setLangMenuOpen(false);
                        }}
                      >
                        {getLanguageName(lang)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="navbar-main">

        {/* LEFT - Logo and Mobile Menu Button */}
        <div className="flex items-center justify-between w-full lg:w-auto">
          <Link
            to="/"
            className="flex items-center gap-2 navbar-brand-link"
            // TASK-8215: the accessible name must not depend on visible text — the logo's
            // alt is decorative ("") and .navbar-logo-text is display:none below 640px, so
            // without this the link's accessible name computes to "" on mobile (axe
            // link-name, WCAG 2.4.4/4.1.2). Derive from the resolved tenant brand name
            // (falls back to the marketplace baseline, never empty) rather than hardcoding
            // "Atlas" so white-label tenants get their own name here too.
            aria-label={`${brandName || 'Atlas'} — home`}
          >
            {showLogo && (
              <img
                src={logoSrc}
                // Wordmark logos visually spell out the brand name, so they carry the real alt
                // text; a plain icon logo sits next to the navbar-logo-text span below, which
                // already names the brand as real text — repeating it in alt is redundant
                // (axe "image-redundant-alt"), so that case is marked decorative instead.
                alt={isWordmarkLogo(logoSrc) ? brandName || "Site logo" : ""}
                className={`navbar-logo${isWordmarkLogo(logoSrc) ? " navbar-logo--wordmark" : ""}${logoSrc.includes("atlas-homes-logo") ? " navbar-logo--stacked" : ""}`}
                loading="eager"
                decoding="async"
                width={isWordmarkLogo(logoSrc) ? 52 : 48}
                height={isWordmarkLogo(logoSrc) ? 48 : 48}
              />
            )}
            {/* Wordmark logos already include the brand name — hide duplicate text */}
            {brandName && !isWordmarkLogo(logoSrc) ? (
              <span className="navbar-logo-text">{brandName}</span>
            ) : null}
          </Link>

          {/* DESIGN-026: persistent mobile search pill — sits between logo and hamburger */}
          <MobileSearchPill />

          {/* Mobile Menu Button - Only visible on mobile */}
          <div className="lg:hidden">
            <button
              type="button"
              className={`mobile-menu-button ${isMenuOpen ? 'open' : ''}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle navigation"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu-panel"
            >
              <span className="sr-only">Toggle navigation</span>
              <span className="hamburger-bar" aria-hidden />
              <span className="hamburger-bar" aria-hidden />
              <span className="hamburger-bar" aria-hidden />
            </button>
          </div>
        </div>

        {/* CENTER - Desktop Navigation: Stays | Hyderabad | Trips | Help */}
        <div className="hidden lg:flex items-center flex-1 justify-center">
          <Link to="/search" className="navbar-search-pill" data-testid="navbar-search-pill">
            <span className="navbar-search-pill__label">Where to?</span>
            <span className="navbar-search-pill__hint">Search stays</span>
          </Link>
        </div>

        <div className="hidden lg:flex items-center">
          <div className="navbar-center flex gap-6">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={navLinkClass}
              >
                {item.label}
              </NavLink>
            ))}
            <div className="relative">
              <button
                type="button"
                className="nav-link"
                aria-expanded={tripsMenuOpen}
                aria-haspopup="true"
                data-testid="navbar-trips-menu"
                onClick={() => setTripsMenuOpen((o) => !o)}
                onBlur={() => window.setTimeout(() => setTripsMenuOpen(false), 150)}
              >
                Trips ▾
              </button>
              {tripsMenuOpen && (
                <div
                  className="absolute left-0 top-full z-50 mt-2 min-w-[11rem] rounded-lg border border-border-subtle bg-bg-surface py-2 shadow-lg"
                  role="menu"
                >
                  {tripsMenuNav.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-text-primary hover:bg-brand-primary/10"
                      onClick={() => setTripsMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT - Desktop: Saved badge + account menu + Book Now (DESIGN-009) */}
        <div className="hidden lg:flex items-center gap-4">
          <NavLink
            to="/favorites"
            className={navLinkClass}
            data-testid="navbar-saved-link"
          >
            <span className="inline-flex items-center gap-1.5">
              Saved
              {savedCount > 0 ? (
                <span
                  className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-cta-primary px-1 text-[10px] font-bold leading-none text-[var(--text-on-cta)]"
                  data-testid="navbar-saved-count"
                  aria-label={`${savedCount} saved listings`}
                >
                  {savedCount > 99 ? '99+' : savedCount}
                </span>
              ) : null}
            </span>
          </NavLink>

          <div className="relative">
            <button
              type="button"
              className="navbar-account-avatar"
              aria-expanded={accountMenuOpen}
              aria-haspopup="true"
              aria-label="Account menu"
              data-testid="navbar-account-menu-trigger"
              onClick={() => setAccountMenuOpen((o) => !o)}
              onBlur={() => window.setTimeout(() => setAccountMenuOpen(false), 150)}
            >
              <span aria-hidden="true">☺</span>
            </button>
            {accountMenuOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-2 min-w-[12rem] rounded-lg border border-border-subtle bg-bg-surface py-2 shadow-lg"
                role="menu"
                data-testid="navbar-account-menu"
              >
                {tripsMenuNav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    role="menuitem"
                    className="block px-4 py-2 text-sm text-text-primary hover:bg-brand-primary/10"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  to="/favorites"
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-text-primary hover:bg-brand-primary/10"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  Wishlists
                </Link>
                <Link
                  to="/contact"
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-text-primary hover:bg-brand-primary/10"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  Help
                </Link>
              </div>
            )}
          </div>

          <button
            type="button"
            className="book-now"
            onClick={handleBookNow}
            aria-busy={ctaStatus === 'navigating'}
            data-state={ctaStatus}
            data-testid="navbar-book-now"
          >
            {ctaNav.label}
          </button>
          {ctaStatus !== 'idle' && (
            <span className="book-now-status" role="status" aria-live="polite">
              {ctaStatus === 'navigating'
                ? 'Opening reservation...'
                : 'Bringing booking form into view...'}
            </span>
          )}
        </div>
      </div>

      {/* MOBILE MENU */}
      {isMenuOpen && (
        <div className="mobile-menu lg:hidden open" id="mobile-menu-panel">
          {/* TASK-7088: each destination once. Help comes from primaryNav (visibleNavItems);
              Search stays / My bookings / Recently viewed / My profile come from tripsMenuNav
              under a single Account group. Do not re-render tripsMenuNav or a second Help link. */}
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.label}
              onClick={closeMobile}
              to={item.to}
              className="block py-2"
            >
              {item.label}
            </NavLink>
          ))}

          {/* MOBILE ACTIONS — account links grouped (DESIGN-009 / TASK-7088) */}
          <div className="mt-2 flex flex-col gap-3">
            <p className="py-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Account</p>
            {tripsMenuNav.map((item) => (
              <NavLink
                key={item.to}
                onClick={closeMobile}
                to={item.to}
                className="block py-2 pl-2 font-semibold"
                data-testid={item.to === '/search' ? 'navbar-search-pill-mobile' : undefined}
              >
                {item.label}
              </NavLink>
            ))}
            <NavLink
              to="/favorites"
              onClick={closeMobile}
              className="block py-2 pl-2 font-semibold"
              data-testid="navbar-saved-link-mobile"
            >
              Saved
              {savedCount > 0 ? (
                <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-cta-primary px-1 text-[10px] font-bold text-[var(--text-on-cta)]">
                  {savedCount > 99 ? '99+' : savedCount}
                </span>
              ) : null}
            </NavLink>

            <button
              type="button"
              className="book-now text-center"
              onClick={handleBookNow}
              aria-busy={ctaStatus === 'navigating'}
              data-state={ctaStatus}
            >
              {ctaNav.label}
            </button>

            {ctaStatus !== 'idle' && (
              <span className="book-now-status" role="status" aria-live="polite">
                {ctaStatus === 'navigating'
                  ? 'Opening reservation...'
                  : 'Bringing booking form into view...'}
              </span>
            )}

          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
