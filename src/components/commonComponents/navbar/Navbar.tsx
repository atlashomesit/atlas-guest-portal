import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import './navbar.css';
import { IoIosCall } from 'react-icons/io';
import { FaWhatsapp } from 'react-icons/fa';
import { buildWaLink } from '../../../utils/whatsapp';
import { sanitizeItems, getItemKey } from '../../../utils/sanitizeItems';
import { primaryNav, moreNav, ctaNav } from '../../../config/navigation';
import { LOGO_URL } from '../../../config/branding';
import { CONTACT, formatDisplayNumber, getTelLink } from '../../../config/contact';
import { propertyData } from '../../../data';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isApartmentsOpen, setIsApartmentsOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const apartments = sanitizeItems(propertyData);

  const whatsappLink = buildWaLink({
    phoneE164: CONTACT.business.whatsapp,
    text: "Hi Atlas Homestays 👋 I'd like to learn more about booking a stay.",
  });
  const telLink = getTelLink();

  useEffect(() => {
    const onLoadfunction = () => {
      const navbar = document.getElementById('navbar_container');
      if (navbar) {
        if (window.scrollY > 20) {
          navbar.classList.add('backdrop-blur');
        } else {
          navbar.classList.remove('backdrop-blur');
        }
      }
    };
    window.addEventListener('scroll', onLoadfunction);
    onLoadfunction();
    return () => window.removeEventListener('scroll', onLoadfunction);
  }, []);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link ${isActive ? 'text-white' : ''}`;

  const closeMobile = () => {
    setIsMenuOpen(false);
    setIsApartmentsOpen(false);
    setIsMoreOpen(false);
  };

  return (
    <section className="navbar-container" id="navbar_container">
      <div className="navbar-main">
        {/* LEFT: Logo + Name */}
        <div className="navbar-left flex items-center justify-between w-full md:w-auto">
          <Link to="/" className="flex items-center gap-2">
            <img className="navbar-logo" src={LOGO_URL} alt="Atlas Homestays logo" />
            <span className="navbar-logo-text">Atlas Homestays</span>
          </Link>

          {/* Mobile hamburger */}
          <button
            className="mobile-menu-button md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={`${isMenuOpen ? 'Close' : 'Open'} navigation menu`}
          >
            ☰
          </button>
        </div>

        {/* CENTER: Desktop Menu */}
        <div className="navbar-center hidden md:flex gap-2">
          <NavLink to="/" className={navLinkClass}>Home</NavLink>

          {primaryNav.filter(i => !i.hidden).map(item =>
            item.label === 'Apartments' ? (
              <div key={item.label} className="dropdown relative">
                <button className="dropdown-button">{item.label}</button>
                <div className="dropdown-menu">
                  <NavLink to={item.to}>Apartments Overview</NavLink>
                  {apartments.map((apt, index) => (
                    <NavLink
                      key={getItemKey(apt, index)}
                      to={`/property_details/${apt.id ?? apt.listingId ?? getItemKey(apt, index)}`}
                    >
                      {apt.property_name || apt.title || `Property ${index + 1}`}
                    </NavLink>
                  ))}
                </div>
              </div>
            ) : (
              <NavLink key={item.label} to={item.to} className={navLinkClass}>{item.label}</NavLink>
            )
          )}

          {/* More dropdown */}
          <div className={`dropdown relative ${isMoreOpen ? 'open' : ''}`}>
            <button
              className="dropdown-button hover:text-[var(--text-contrast)]"
              onClick={() => setIsMoreOpen(!isMoreOpen)}
            >
              More
            </button>
            <div className="dropdown-menu">
              {moreNav.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className="block px-4 pt-2 pb-0 text-sm text-text-primary hover:bg-bg-muted hover:text-[var(--text-primary)] transition-colors"
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Desktop Phone + Book Now */}
        <div className="navbar-right hidden md:flex gap-2">
          <a href={telLink} className="phone">
            <IoIosCall className="text-lg md:text-xl" />
            <span>{formatDisplayNumber()}</span>
          </a>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="book-now">
            {ctaNav.label}
          </a>
        </div>
      </div>

      {/* MOBILE MENU (Slide Down) */}
      {isMenuOpen && (
        <div className="mobile-menu md:hidden">
          {/* Nav Links */}
          <NavLink onClick={closeMobile} to="/" className="block py-2">Home</NavLink>

          {/* Apartments */}
          <button
            onClick={() => setIsApartmentsOpen(!isApartmentsOpen)}
            className="block py-2 font-semibold text-text-primary hover:text-[var(--text-contrast)] transition-colors"
          >
            Apartments
          </button>
          {isApartmentsOpen && (
            <div className="pl-2">
              <NavLink onClick={closeMobile} to="/apartments">Apartments Overview</NavLink>
              {apartments.map((apt, idx) => (
                <NavLink
                  key={getItemKey(apt, idx)}
                  onClick={closeMobile}
                  to={`/property_details/${apt.id ?? apt.listingId ?? getItemKey(apt, idx)}`}
                  className="block py-1"
                >
                  {apt.property_name || apt.title}
                </NavLink>
              ))}
            </div>
          )}

          {/* More */}
          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className="block py-2 font-semibold text-text-primary hover:text-[var(--text-contrast)] transition-colors"
          >
            More
          </button>
          {isMoreOpen && (
            <div className="pl-2">
              {moreNav.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  onClick={closeMobile}
                  className="block py-1 text-text-primary hover:text-[var(--text-contrast)] transition-colors"
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}

          {/* Mobile Phone + Book Now */}
          <div className="mt-2 flex flex-col gap-2">
            <a
              href={telLink}
              className="phone flex items-center gap-2 font-semibold text-text-primary hover:text-[var(--text-contrast)] transition-colors"
            >
              <IoIosCall className="text-lg" />
              <span>{formatDisplayNumber()}</span>
            </a>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="book-now text-center"
            >
              {ctaNav.label}
            </a>
          </div>
        </div>
      )}
    </section>
  );
};

export default Navbar;
