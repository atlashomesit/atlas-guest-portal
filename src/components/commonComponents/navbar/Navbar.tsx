import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation, matchPath } from 'react-router-dom';
import './navbar.css';

import { IoIosCall } from 'react-icons/io';
import { primaryNav, ctaNav } from '../../../config/navigation';
import { LOGO_URL } from '../../../config/branding';
import { formatDisplayNumber, getTelLink } from '../../../config/contact';
import { trackEvent } from '../../../utils/analytics';
import { homes } from '../../../content/homes';
import { useBooking } from '../../../contexts/BookingContext';
import { ThemeSwitcher } from '../../ui/ThemeSwitcher';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHomesOpen, setIsHomesOpen] = useState(false);
  const [isHomesMobileOpen, setIsHomesMobileOpen] = useState(false);
  const [ctaStatus, setCtaStatus] = useState<'idle' | 'navigating' | 'scrolling'>('idle');

  const homesDropdownRef = useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { booking } = useBooking();

  const telLink = getTelLink();

  /* =========================
     NAVBAR SCROLL EFFECT
  ========================= */
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
    <section className="navbar-container" id="navbar_container">
      <div className="navbar-main">

        {/* LEFT */}
        <div className="navbar-left flex items-center justify-between w-full lg:w-auto">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={LOGO_URL}
              alt="Atlas Homestays"
              className="navbar-logo"
            />
            <span className="navbar-logo-text">Atlas Homestays</span>
          </Link>

          <button
            type="button"
            className={`mobile-menu-button lg:hidden ${isMenuOpen ? 'open' : ''}`}
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

        {/* CENTER */}
        <div className="navbar-center hidden lg:flex gap-2">
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

                <div className="dropdown-menu" role="menu" id="homes-menu">
                  {homes.map((home) => (
                    <Link
                      key={home.roomNo}
                      to={home.href}
                      role="menuitem"
                      onClick={handleHomeSelect}
                    >
                      {home.title}
                    </Link>
                  ))}
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

        {/* RIGHT */}
        <div className="navbar-right flex gap-3">
          <div className="hidden lg:block">
            <ThemeSwitcher />
          </div>
          
          <a href={telLink} className="phone">
            <IoIosCall />
            <span>{formatDisplayNumber()}</span>
          </a>

          {/* BOOK NOW */}
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              className="book-now"
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
                    {homes.map((home) => (
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
            <div className="py-2">
              <ThemeSwitcher />
            </div>
            
            <a href={telLink} className="phone flex items-center gap-2">
              <IoIosCall />
              <span>{formatDisplayNumber()}</span>
            </a>

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
    </section>
  );
};

export default Navbar;
