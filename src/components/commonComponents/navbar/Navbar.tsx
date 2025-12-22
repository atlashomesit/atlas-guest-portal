import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import './navbar.css';
import { IoIosCall } from 'react-icons/io';
import { buildWaLink } from '../../../utils/whatsapp';
import { sanitizeItems, getItemKey } from '../../../utils/sanitizeItems';
import { primaryNav, ctaNav } from '../../../config/navigation';
import { LOGO_URL } from '../../../config/branding';
import { CONTACT, formatDisplayNumber, getTelLink } from '../../../config/contact';
import { propertyData } from '../../../data';
import { trackEvent } from '../../../utils/analytics';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isApartmentsOpen, setIsApartmentsOpen] = useState(false);

  const apartments = sanitizeItems(propertyData);

  const whatsappLink = buildWaLink({
    phoneE164: CONTACT.business.whatsapp,
    text: "Hi Atlas Homestays 👋 I'd like to learn more about booking a stay.",
  });
  const telLink = getTelLink();
  const bookNowTarget = ctaNav.to;

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

        </div>

        {/* RIGHT: Phone + Book Now */}
        <div className="navbar-right flex gap-2">
          <a href={telLink} className="phone" aria-label="Call Atlas Homestays">
            <IoIosCall className="text-lg md:text-xl" />
            <span>{formatDisplayNumber()}</span>
          </a>
          <Link
            to={bookNowTarget}
            className="book-now"
            aria-label="Book now"
            onClick={() => {
              trackEvent('cta_book_now_clicked', { source: 'header' }, { route: bookNowTarget });
            }}
          >
            {ctaNav.label}
          </Link>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="help-link"
            aria-label="Need help on WhatsApp"
          >
            Need help?
          </a>
        </div>
      </div>

      {/* MOBILE MENU (Slide Down) */}
      {isMenuOpen && (
        <div className="mobile-menu md:hidden">
          {primaryNav.filter((item) => !item.hidden).map((item) => (
            item.label === 'Apartments' ? (
              <div key={item.label}>
                <button
                  onClick={() => setIsApartmentsOpen(!isApartmentsOpen)}
                  className="block py-2 font-semibold text-text-primary hover:text-[var(--text-contrast)] transition-colors w-full text-left"
                >
                  {item.label}
                </button>
                {isApartmentsOpen && (
                  <div className="pl-2">
                    <NavLink onClick={closeMobile} to={item.to}>Apartments Overview</NavLink>
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
              </div>
            ) : (
              <NavLink key={item.label} onClick={closeMobile} to={item.to} className="block py-2">
                {item.label}
              </NavLink>
            )
          ))}

          {/* Mobile Phone + Book Now */}
          <div className="mt-2 flex flex-col gap-2">
            <a
              href={telLink}
              className="phone flex items-center gap-2 font-semibold text-text-primary hover:text-[var(--text-contrast)] transition-colors"
              aria-label="Call Atlas Homestays"
            >
              <IoIosCall className="text-lg" />
              <span>{formatDisplayNumber()}</span>
            </a>
            <Link
              to={bookNowTarget}
              className="book-now text-center"
              aria-label="Book now"
              onClick={() => {
                trackEvent('cta_book_now_clicked', { source: 'header' }, { route: bookNowTarget });
                closeMobile();
              }}
            >
              {ctaNav.label}
            </Link>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="help-link text-center"
              aria-label="Need help on WhatsApp"
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
