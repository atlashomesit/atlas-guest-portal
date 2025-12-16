import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import './navbar.css';
import { IoIosMail, IoIosCall } from 'react-icons/io';
import { IoLogoWhatsapp } from "react-icons/io";
import { FaFacebook, FaTwitter, FaYoutube, FaInstagram } from 'react-icons/fa';
import { ImGithub } from 'react-icons/im';
import { IoIosArrowForward } from "react-icons/io";
import { footerData, propertyData } from '../../../data';
import logo from '../../../assets/logo.svg';
import { getItemKey, sanitizeItems } from '../../../utils/sanitizeItems';
import { buildWaLink } from '../../../utils/whatsapp';

const iconMap = {
    ImGithub,
    FaTwitter,
    FaFacebook,
    FaInstagram,
    FaYoutube,
    IoIosMail,
    IoIosCall,
    IoIosArrowForward
};

const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isApartmentsOpen, setIsApartmentsOpen] = useState(false);
    const [isBlogOpen, setIsBlogOpen] = useState(false);
    const apartments = sanitizeItems(propertyData);
    const whatsappPhone = import.meta.env.VITE_WHATSAPP_PHONE_E164 || '+917032493290';
    const whatsappLink = buildWaLink({
        phoneE164: whatsappPhone,
        text: "Hi Atlas Homestays 👋 I'd like to learn more about booking a stay.",
    });

    useEffect(() => {
        const onLoadfunction = () => {
            const navbar = document.getElementById('navbar_container');
            if (navbar) {
                if (window.scrollY > 20) {
                    navbar.classList.add('bg-white/90', 'backdrop-blur');
                } else {
                    navbar.classList.remove('bg-white/90', 'backdrop-blur');
                }
            }
        };

        window.addEventListener('scroll', onLoadfunction);
        onLoadfunction();

        return () => {
            window.removeEventListener('scroll', onLoadfunction);
        };
    }, []);

    const navLinkClass = ({ isActive }: { isActive: boolean }) =>
        `px-3 py-2 text-sm font-semibold transition ${isActive ? 'text-primary' : 'text-slate-800 hover:text-primary'}`;

    const closeMobile = () => {
        setIsMenuOpen(false);
        setIsApartmentsOpen(false);
        setIsBlogOpen(false);
    };

    return (
        <section className='navbar-container w-full h-fit fixed top-0 z-50 shadow-sm'>
            {/* Email and Phone */}
            <div className="bg-primary flex flex-wrap text-white justify-between items-center gap-4 p-2 md:p-4 md:flex-nowrap">
                <div className="flex flex-col md:flex-row justify-center items-center gap-4 w-full md:w-auto">
                    <div className="flex flex-col items-center gap-4 md:flex-row">
                        <div className="flex gap-4">
                            {footerData.socialLinks.map(({ icon, link }, index) => {
                                const IconComponent = iconMap[icon];
                                return (
                                    <a key={index} href={link} target="_blank" rel="noopener noreferrer">
                                        <IconComponent className="hover:text-white duration-300 cursor-pointer text-sm md:text-base" />
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                    <span className="text-slate-400 hidden md:block">|</span>

                    <div className="flex flex-col md:flex-row gap-4 text-center md:text-left">
                        <div className="flex items-center gap-2 font-semibold md:font-medium">
                            <IoIosMail className="text-lg md:text-2xl" />
                            <a href="mailto:atlashomeskphb@gmail.com" className="text-sm md:text-base hover:text-gray-300">
                                atlashomeskphb@gmail.com
                            </a>
                        </div>
                    </div>
                </div>

                <div className="flex flex-row justify-center items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-2 font-semibold md:font-medium">
                        <IoIosCall className="text-lg md:text-xl" />
                        <span className="text-sm md:text-base">+91-7032493290</span>
                    </div>
                    <span className="text-slate-400 hidden md:block">|</span>
                    <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-500 text-2xl"
                    >
                        <IoLogoWhatsapp />
                    </a>
                    <span className="text-slate-400 hidden md:block">|</span>
                    <a
                        href="https://www.instagram.com/atlashomeskphb/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <path
                                d="M7 2C4.24 2 2 4.24 2 7V17C2 19.76 4.24 22 7 22H17C19.76 22 22 19.76 22 17V7C22 4.24 19.76 2 17 2H7ZM7 4H17C18.66 4 20 5.34 20 7V17C20 18.66 18.66 20 17 20H7C5.34 20 4 18.66 4 17V7C4 5.34 5.34 4 7 4ZM17 6C16.45 6 16 6.45 16 7C16 7.55 16.45 8 17 8C17.55 8 18 7.55 18 7C18 6.45 17.55 6 17 6ZM12 7C9.24 7 7 9.24 7 12C7 14.76 9.24 17 12 17C14.76 17 17 14.76 17 12C17 9.24 14.76 7 12 7ZM12 9C13.66 9 15 10.34 15 12C15 13.66 13.66 15 12 15C10.34 15 9 13.66 9 12C9 10.34 10.34 9 12 9Z"
                                fill="#E4405F"
                            />
                        </svg>
                    </a>
                </div>
            </div>

            {/* Main Nav */}
            <div id='navbar_container' className='bg-white transition-all duration-300 w-full flex items-center justify-between px-4 py-3 md:py-4 md:px-12'>
                <Link to='/' className='flex items-center gap-3'>
                    <img className='w-20 h-16 object-contain rounded-md' src={logo} alt='Atlas Homestays logo' />
                    <span className='font-bold text-lg text-slate-900 hidden sm:block'>Atlas Homestays</span>
                </Link>

                <button className='md:hidden text-2xl text-slate-800' onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label='Toggle menu'>
                    ☰
                </button>

                <div className='hidden md:flex items-center gap-4'>
                    <NavLink to='/' className={navLinkClass}>Home</NavLink>

                    <div className='relative group'>
                        <button className='px-3 py-2 text-sm font-semibold text-slate-800 hover:text-primary flex items-center gap-1'>
                            Apartments
                        </button>
                        <div className='absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition bg-white border border-slate-200 rounded-xl shadow-lg min-w-[220px] py-2'>
                            <NavLink to='/apartments' className='block px-4 py-2 text-sm text-slate-800 hover:bg-slate-50'>Apartments Overview</NavLink>
                            {apartments.map((apt, index) => (
                                <NavLink
                                    key={getItemKey(apt, index)}
                                    to={`/property_details/${apt.id ?? apt.listingId ?? getItemKey(apt, index)}`}
                                    className='block px-4 py-2 text-sm text-slate-800 hover:bg-slate-50'
                                >
                                    {apt.property_name || apt.title || `Property ${apt.id ?? apt.listingId}`}
                                </NavLink>
                            ))}
                        </div>
                    </div>

                    <NavLink to='/amenities' className={navLinkClass}>Amenities</NavLink>
                    <NavLink to='/location' className={navLinkClass}>Location</NavLink>
                    <NavLink to='/faq' className={navLinkClass}>FAQ</NavLink>
                    <NavLink to='/gallery' className={navLinkClass}>Gallery</NavLink>
                    <NavLink to='/offers' className={navLinkClass}>Offers</NavLink>

                    <div className='relative group'>
                        <button className='px-3 py-2 text-sm font-semibold text-slate-800 hover:text-primary flex items-center gap-1'>
                            Blog
                        </button>
                        <div className='absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition bg-white border border-slate-200 rounded-xl shadow-lg min-w-[200px] py-2'>
                            <NavLink to='/blog' className='block px-4 py-2 text-sm text-slate-800 hover:bg-slate-50'>Blog Home</NavLink>
                            <NavLink to='/blog/guest-guides' className='block px-4 py-2 text-sm text-slate-800 hover:bg-slate-50'>Guest Guides</NavLink>
                            <NavLink to='/blog/hospitality-tech' className='block px-4 py-2 text-sm text-slate-800 hover:bg-slate-50'>Hospitality Tech & AI</NavLink>
                        </div>
                    </div>

                    <NavLink to='/about' className={navLinkClass}>About Us</NavLink>
                    <NavLink to='/policies' className={navLinkClass}>Policies</NavLink>
                    <NavLink to='/contact' className={navLinkClass}>Contact Us</NavLink>
                    <a href={whatsappLink} className='px-4 py-2 bg-primary text-white font-semibold rounded-full shadow-md hover:shadow-lg transition'>Book Now</a>
                </div>
            </div>

            {isMenuOpen && (
                <div className='md:hidden bg-white border-t border-slate-200 shadow-lg px-4 py-3 space-y-2'>
                    <NavLink onClick={closeMobile} to='/' className='block py-2 text-slate-800 font-semibold'>Home</NavLink>

                    <button onClick={() => setIsApartmentsOpen(!isApartmentsOpen)} className='w-full text-left py-2 font-semibold text-slate-800'>
                        Apartments
                    </button>
                    {isApartmentsOpen && (
                        <div className='pl-4 space-y-1'>
                            <NavLink onClick={closeMobile} to='/apartments' className='block py-1 text-sm text-slate-700'>Apartments Overview</NavLink>
                            {apartments.map((apt, index) => (
                                <NavLink
                                    key={getItemKey(apt, index)}
                                    onClick={closeMobile}
                                    to={`/property_details/${apt.id ?? apt.listingId ?? getItemKey(apt, index)}`}
                                    className='block py-1 text-sm text-slate-700'
                                >
                                    {apt.property_name || apt.title || `Property ${apt.id ?? apt.listingId}`}
                                </NavLink>
                            ))}
                        </div>
                    )}

                    <NavLink onClick={closeMobile} to='/amenities' className='block py-2 text-slate-800 font-semibold'>Amenities</NavLink>
                    <NavLink onClick={closeMobile} to='/location' className='block py-2 text-slate-800 font-semibold'>Location</NavLink>
                    <NavLink onClick={closeMobile} to='/faq' className='block py-2 text-slate-800 font-semibold'>FAQ</NavLink>
                    <NavLink onClick={closeMobile} to='/gallery' className='block py-2 text-slate-800 font-semibold'>Gallery</NavLink>
                    <NavLink onClick={closeMobile} to='/offers' className='block py-2 text-slate-800 font-semibold'>Offers</NavLink>

                    <button onClick={() => setIsBlogOpen(!isBlogOpen)} className='w-full text-left py-2 font-semibold text-slate-800'>
                        Blog
                    </button>
                    {isBlogOpen && (
                        <div className='pl-4 space-y-1'>
                            <NavLink onClick={closeMobile} to='/blog' className='block py-1 text-sm text-slate-700'>Blog Home</NavLink>
                            <NavLink onClick={closeMobile} to='/blog/guest-guides' className='block py-1 text-sm text-slate-700'>Guest Guides</NavLink>
                            <NavLink onClick={closeMobile} to='/blog/hospitality-tech' className='block py-1 text-sm text-slate-700'>Hospitality Tech & AI</NavLink>
                        </div>
                    )}

                    <NavLink onClick={closeMobile} to='/about' className='block py-2 text-slate-800 font-semibold'>About Us</NavLink>
                    <NavLink onClick={closeMobile} to='/policies' className='block py-2 text-slate-800 font-semibold'>Policies</NavLink>
                    <NavLink onClick={closeMobile} to='/contact' className='block py-2 text-slate-800 font-semibold'>Contact Us</NavLink>
                    <a href={whatsappLink} className='block py-2 text-primary font-bold'>Book Now</a>
                </div>
            )}
        </section>
    );
};

export default Navbar;
