import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
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

  const navigate = useNavigate();

  const apartments = sanitizeItems(propertyData);

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
    setIsApartmentsOpen(false);
  };

  /* =========================
     BOOK NOW HANDLER
  ========================= */
  const handleBookNow = () => {
    trackEvent(
      'cta_book_now_clicked',
      { source: 'header' },
      { route: '/' }
    );

    navigate('/', {
      state: { scrollTo: 'our-homes' }
    });

    closeMobile();
  };

  return (
    <section className="navbar-container" id="navbar_container">
      <div className="navbar-main">
        {/* LEFT */}
        <div className="navbar-left flex items-center justify-between w-full lg:w-auto">
          <Link to="/" className="flex items-center gap-2">
            <img className="navbar-logo" src={LOGO_URL} alt="Atlas Homestays logo" />
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
              <NavLink key={item.label} to={item.to} className={navLinkClass}>
                {item.label}
              </NavLink>
            )
          )}
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
        <div className="mobile-menu lg:hidden">
          {primaryNav.filter(i => !i.hidden).map(item =>
            item.label === 'Apartments' ? (
              <div key={item.label}>
                <button
                  onClick={() => setIsApartmentsOpen(!isApartmentsOpen)}
                  className="block py-2 font-semibold w-full text-left"
                >
                  {item.label}
                </button>

                {isApartmentsOpen && (
                  <div className="pl-2">
                    <NavLink onClick={closeMobile} to={item.to}>
                      Apartments Overview
                    </NavLink>

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
              <NavLink
                key={item.label}
                onClick={closeMobile}
                to={item.to}
                className="block py-2"
              >
                {item.label}
              </NavLink>
            )
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
