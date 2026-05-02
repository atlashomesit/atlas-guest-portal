import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation, matchPath } from 'react-router-dom';
import './navbar.css';

import { IoIosCall } from 'react-icons/io';
import { Loader } from 'lucide-react';
import { primaryNav, ctaNav } from '../../../config/navigation';
import { LOGO_URL } from '../../../config/branding';
import { getTenantContext } from '../../../tenant/tenantContext';
import { getTenantOverrides } from '../../../tenant/tenantOverrides';
import { formatDisplayNumber, getTelLink } from '../../../config/contact';
import { trackEvent } from '../../../utils/analytics';
import { getFavoriteIds } from '../../../utils/guestHistory';
import { homes as defaultHomes } from '../../../content/homes';
import { useBooking } from '../../../contexts/BookingContext';
import { usePropertyListings } from '../../../hooks/usePropertyListings';
import CurrencySelector from '../../CurrencySelector';

const Navbar = () => {
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  const logoSrc = tenant?.logoUrl ?? LOGO_URL;
  const brandName = overrides.hideAtlasHomesBranding
    ? (tenant?.name?.trim() ?? '')
    : (tenant?.name ?? 'Atlas Homestays');
  const showLogo = !overrides.hideLogo;
  const showListProperty = !overrides.hideListProperty;

  const apiListings = usePropertyListings();
  const homesEntries = apiListings.usedFallback
    ? (overrides.homes ?? defaultHomes)
    : apiListings.homes;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHomesOpen, setIsHomesOpen] = useState(false);
  const [isHomesMobileOpen, setIsHomesMobileOpen] = useState(false);
  const [ctaStatus, setCtaStatus] = useState<'idle' | 'navigating' | 'scrolling'>('idle');
  const [savedCount, setSavedCount] = useState(0);

  const homesDropdownRef = useRef<HTMLDivElement | null>(null);

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

  /* Navbar scroll blur */
  useEffect(() => {
    const onScroll = () => {
      const navbar = document.getElementById('navbar_container');
      if (!navbar) return;

      if (window.scrollY > 20) {
        navbar.classList.add('backdrop-blur');
      } else {
        navbar.classList.remove('backdrop-blur');
      }
    };

    window.addEventListener('scroll', onScroll);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link ${isActive ? 'text-white' : ''}`;

  const closeMobile = () => {
    setIsMenuOpen(false);
    setIsHomesMobileOpen(false);
  };

  const handleHomeSelect = () => {
    setIsHomesOpen(false);
    closeMobile();
  };

  /* =========================
     ✅ FINAL BOOK NOW HANDLER
  ========================= */
  const handleBookNow = () => {
    const propertyMatch =
      matchPath('/property_details/:id', location.pathname) ?? matchPath('/properties/:id', location.pathname);
    const propertyIdFromRoute = propertyMatch?.params.id ?? null;
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
      const bookingForm = document.getElementById('booking-form');
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

  const handleOutsideClick = (event: MouseEvent) => {
    if (homesDropdownRef.current && !homesDropdownRef.current.contains(event.target as Node)) {
      setIsHomesOpen(false);
    }
  };

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsHomesOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    setIsHomesOpen(false);
    setIsHomesMobileOpen(false);
    setIsMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

  const visibleNavItems = primaryNav.filter((item) => !item.hidden);

  useEffect(() => {
    setCtaStatus('idle');
  }, [location.pathname]);

  return (
    <header className="navbar-container" id="navbar_container">
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

        {/* CENTER - Desktop Navigation */}
        <div className="hidden lg:flex items-center">
          <div className="navbar-center flex gap-6">
          {visibleNavItems.map((item) => (
            item.label === 'Our Homes' ? (
              <div
                key={item.label}
                className={`dropdown ${isHomesOpen ? 'open' : ''}`}
                ref={homesDropdownRef}
                onMouseEnter={() => setIsHomesOpen(true)}
                onMouseLeave={() => setIsHomesOpen(false)}
              >
                <button
                  type="button"
                  className="dropdown-button"
                  aria-haspopup="menu"
                  aria-expanded={isHomesOpen}
                  aria-controls="homes-menu"
                  onClick={() => setIsHomesOpen((prev) => !prev)}
                >
                  Our Homes
                </button>

                <div className="dropdown-menu dropdown-menu-scrollable" role="menu" id="homes-menu">
                  {apiListings.isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader size={20} className="animate-spin text-brand-primary" />
                    </div>
                  ) : homesEntries.length === 0 ? (
                    <div className="dropdown-menu-empty" role="presentation">
                      No listings available
                    </div>
                  ) : (
                    homesEntries.map((home) => (
                      <Link
                        key={home.roomNo}
                        to={home.href}
                        role="menuitem"
                        onClick={handleHomeSelect}
                      >
                        {home.title}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <NavLink
                key={item.label}
                to={item.to}
                className={navLinkClass}
              >
                {item.label}
              </NavLink>
            )
          ))}
          </div>
        </div>

        {/* RIGHT - Desktop Actions */}
        <div className="hidden lg:flex items-center gap-6">
          {showListProperty && (
            <Link
              to="/become-a-host"
              className="nav-link"
              data-testid="navbar-list-property"
              style={{ fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              List your property
            </Link>
          )}

          <a href={telLink} className="phone flex items-center gap-1">
            <span>{formatDisplayNumber()}</span>
          </a>

          <CurrencySelector />

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
            item.label === 'Our Homes' ? (
              <div key={item.label}>
                <button
                  type="button"
                  className="block py-2 text-left font-semibold"
                  aria-expanded={isHomesMobileOpen}
                  aria-controls="mobile-homes-menu"
                  aria-haspopup="menu"
                  onClick={() => setIsHomesMobileOpen((prev) => !prev)}
                >
                  Our Homes
                </button>

                {isHomesMobileOpen && (
                  <div id="mobile-homes-menu" className="mobile-submenu">
                    {homesEntries.map((home) => (
                      <Link
                        key={home.roomNo}
                        to={home.href}
                        role="menuitem"
                        className="block py-1 text-sm"
                        onClick={handleHomeSelect}
                      >
                        {home.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                key={item.label}
                onClick={closeMobile}
                to={item.to}
                className="block py-2"
              >
                {item.label}
              </NavLink>
            )
          ))}

          {/* MOBILE ACTIONS */}
          <div className="mt-2 flex flex-col gap-3">
            {showListProperty && (
              <Link
                to="/become-a-host"
                onClick={closeMobile}
                className="block py-2 font-semibold"
                style={{ color: 'var(--cta-primary, #2563eb)' }}
              >
                List your property
              </Link>
            )}

            <a href={telLink} className="phone flex items-center gap-2">
              <IoIosCall />
              <span>{formatDisplayNumber()}</span>
            </a>

            <CurrencySelector />

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
