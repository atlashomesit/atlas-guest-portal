import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation, matchPath } from 'react-router-dom';
import './navbar.css';

import { primaryNav, ctaNav } from '../../../config/navigation';
import { LOGO_URL } from '../../../config/branding';
import { getTenantContext } from '../../../tenant/tenantContext';
import { getTenantOverrides, shouldHideAtlasBranding } from '../../../tenant/tenantOverrides';
import { formatDisplayNumber, getTelLink } from '../../../config/contact';
import { trackEvent } from '../../../utils/analytics';
import { getFavoriteIds } from '../../../utils/guestHistory';
import { useBooking } from '../../../contexts/BookingContext';

const Navbar = () => {
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  const hideAtlasBranding = shouldHideAtlasBranding(tenant, overrides);
  const logoSrc = tenant?.logoUrl ?? LOGO_URL;
  // RA-006 §3.5: prefer tenant name everywhere; only fall back to "Home" on the Atlas root.
  const brandName = hideAtlasBranding
    ? (tenant?.name?.trim() ?? '')
    : (tenant?.name ?? 'Home');
  const showLogo = !overrides.hideLogo;
  const showListProperty = !overrides.hideListProperty;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [ctaStatus, setCtaStatus] = useState<'idle' | 'navigating' | 'scrolling'>('idle');
  const [savedCount, setSavedCount] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const { booking } = useBooking();

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
    const propertyIdFromRoute = propertyMatch?.params.unitSlug ?? propertyMatch?.params.roomNo ?? propertyMatch?.params.id ?? null;
    const isPropertyDetailsRoute = Boolean(propertyMatch);
    const bookingTarget = isPropertyDetailsRoute ? 'booking-form' : 'search';
    const bookingSurface = isPropertyDetailsRoute ? 'property_details' : 'navbar';

    setCtaStatus(isPropertyDetailsRoute ? 'scrolling' : 'navigating');

    const bookingState = {
      propertyId: booking.propertyId ?? propertyIdFromRoute ?? undefined,
      checkIn: booking.checkIn ?? undefined,
      checkOut: booking.checkOut ?? undefined,
      guests: booking.guests,
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

  const visibleNavItems = primaryNav.filter((item) => !item.hidden);

  useEffect(() => {
    setCtaStatus('idle');
  }, [location.pathname]);

  return (
    <header className="navbar-container" id="navbar_container">
      {/* Slim utility bar — Home v2 design §1: dark strip above main header */}
      <div className="util-bar" aria-hidden="false">
        <div className="util-bar-inner">
          <div className="util-bar-left">
            {showListProperty && (
              <a href="/become-a-host">List your property</a>
            )}
            <a
              href={`${(import.meta.env.VITE_ADMIN_PORTAL_URL as string | undefined)?.trim() || 'https://app.atlaspms.in'}/login`}
              rel="noopener noreferrer"
            >
              Host login
            </a>
          </div>
          <div className="util-bar-right">
            <a className="util-bar-phone" href={telLink}>{formatDisplayNumber()}</a>
            <span className="util-bar-sep" aria-hidden="true" />
            <span className="util-bar-locale">INR ₹</span>
            <span className="util-bar-sep" aria-hidden="true" />
            <span className="util-bar-locale">EN</span>
          </div>
        </div>
      </div>

      <div className="navbar-main">

        {/* LEFT - Logo and Mobile Menu Button */}
        <div className="flex items-center justify-between w-full lg:w-auto">
          <Link to="/" className="flex items-center gap-2">
            {showLogo && (
              <img
                src={logoSrc}
                alt=""
                aria-hidden="true"
                className="navbar-logo"
              />
            )}
            {brandName ? <span className="navbar-logo-text">{brandName}</span> : null}
          </Link>

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
          </div>
        </div>

        {/* RIGHT - Desktop Actions: Saved | Book Now only (utility bar has phone/login/currency) */}
        <div className="hidden lg:flex items-center gap-6">
          <NavLink
            to="/favorites"
            className={navLinkClass}
            data-testid="navbar-saved-link"
          >
            <span className="inline-flex items-center gap-1.5">
              Saved
              {savedCount > 0 ? (
                <span
                  className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-cta-primary px-1 text-[10px] font-bold leading-none text-white"
                  data-testid="navbar-saved-count"
                  aria-label={`${savedCount} saved listings`}
                >
                  {savedCount > 99 ? '99+' : savedCount}
                </span>
              ) : null}
            </span>
          </NavLink>

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

          {/* MOBILE ACTIONS */}
          <div className="mt-2 flex flex-col gap-3">
            <NavLink
              to="/favorites"
              onClick={closeMobile}
              className="block py-2 font-semibold"
              data-testid="navbar-saved-link-mobile"
            >
              Saved
              {savedCount > 0 ? (
                <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-cta-primary px-1 text-[10px] font-bold text-white">
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
