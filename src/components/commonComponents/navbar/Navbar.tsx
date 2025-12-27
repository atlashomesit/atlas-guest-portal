import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import './navbar.css';

import { IoIosCall } from 'react-icons/io';
import { buildWaLink } from '../../../utils/whatsapp';
import { primaryNav, ctaNav } from '../../../config/navigation';
import { LOGO_URL } from '../../../config/branding';
import { CONTACT, formatDisplayNumber, getTelLink } from '../../../config/contact';
import { trackEvent } from '../../../utils/analytics';
import { rooms } from '../../../content/rooms';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHomesOpen, setIsHomesOpen] = useState(false);
  const [isHomesMobileOpen, setIsHomesMobileOpen] = useState(false);

  const homesDropdownRef = useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const whatsappLink = buildWaLink({
    phoneE164: CONTACT.business.whatsapp,
    text: "Hi Atlas Homestays 👋 I'd like to learn more about booking a stay.",
  });

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

  /* =========================
     ✅ FINAL BOOK NOW HANDLER
  ========================= */
  const handleBookNow = () => {
    trackEvent('cta_book_now_clicked', { source: 'header' }, { route: '/#our-homes' });

    // CASE 1: Already on home page → scroll
    if (location.pathname === '/') {
      const el = document.getElementById('our-homes');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    // CASE 2: On another page → navigate then scroll
    else {
      navigate('/', {
        state: { scrollTo: 'our-homes' },
      });
    }

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

  const baseNavItems = primaryNav.filter((item) => item.label !== 'Our Homes');

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
            className="mobile-menu-button lg:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            ☰
          </button>
        </div>

        {/* CENTER */}
        <div className="navbar-center hidden lg:flex gap-2">
          {baseNavItems.filter(i => !i.hidden).map(item => (
            <NavLink
              key={item.label}
              to={item.to}
              className={navLinkClass}
            >
              {item.label}
            </NavLink>
          ))}

          <div
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
              onClick={() => setIsHomesOpen((prev) => !prev)}
            >
              Our Homes
            </button>

            <div className="dropdown-menu" role="menu">
              {rooms.map((room) => (
                <Link
                  key={room.roomNo}
                  to={room.route}
                  role="menuitem"
                  onClick={() => setIsHomesOpen(false)}
                >
                  {room.title}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="navbar-right flex gap-2">
          <a href={telLink} className="phone">
            <IoIosCall />
            <span>{formatDisplayNumber()}</span>
          </a>

          {/* BOOK NOW */}
          <button
            type="button"
            className="book-now"
            onClick={handleBookNow}
          >
            {ctaNav.label}
          </button>

          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="help-link"
          >
            Need help?
          </a>
        </div>
      </div>

      {/* MOBILE MENU */}
      {isMenuOpen && (
        <div className="mobile-menu lg:hidden open">
          {baseNavItems.filter(i => !i.hidden).map(item => (
            <NavLink
              key={item.label}
              onClick={closeMobile}
              to={item.to}
              className="block py-2"
            >
              {item.label}
            </NavLink>
          ))}

          <button
            type="button"
            className="block py-2 text-left font-semibold"
            aria-expanded={isHomesMobileOpen}
            aria-controls="mobile-homes-menu"
            onClick={() => setIsHomesMobileOpen((prev) => !prev)}
          >
            Our Homes
          </button>

          {isHomesMobileOpen && (
            <div id="mobile-homes-menu" className="mobile-submenu">
              {rooms.map((room) => (
                <Link
                  key={room.roomNo}
                  to={room.route}
                  role="menuitem"
                  className="block py-1 text-sm"
                  onClick={closeMobile}
                >
                  {room.title}
                </Link>
              ))}
            </div>
          )}

          {/* MOBILE ACTIONS */}
          <div className="mt-2 flex flex-col gap-2">
            <a href={telLink} className="phone flex items-center gap-2">
              <IoIosCall />
              <span>{formatDisplayNumber()}</span>
            </a>

            <button
              type="button"
              className="book-now text-center"
              onClick={handleBookNow}
            >
              {ctaNav.label}
            </button>

            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="help-link text-center"
              onClick={closeMobile}
            >
              Need help?
            </a>
          </div>
        </div>
      )}
    </section>
  );
};

export default Navbar;
