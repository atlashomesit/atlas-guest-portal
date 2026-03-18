import { FaFacebook, FaTwitter, FaYoutube, FaInstagram } from 'react-icons/fa';
import { ImGithub } from 'react-icons/im';
import { IoIosMail, IoIosCall, IoIosArrowForward } from "react-icons/io";
import { footerData } from '../../../data';
import { Link } from 'react-router-dom';
import { helpNav, moreNav, primaryNav } from '../../../config/navigation';
import { LOGO_URL } from '../../../config/branding';
import { CompactThemeSwitcher } from '../../ui/CompactThemeSwitcher';

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

const Footer = () => {
    const socialLinks = Array.isArray(footerData?.socialLinks) ? footerData.socialLinks : [];
    const contactInfo = Array.isArray(footerData?.contactInfo) ? footerData.contactInfo : [];
    const logoSrc = LOGO_URL;

    return (
<<<<<<< HEAD
        <footer
            className='py-16 md:py-20 px-[5%] text-[var(--footer-text)] border-t border-white/10'
            style={{ background: 'var(--footer-bg)' }}
        >
            <div className='max-w-luxury mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12'>
                <div className='flex flex-col gap-4 items-center lg:items-start'>
                    <img className='w-32 md:w-24 rounded-md' src={logoSrc} alt="Atlas Homestays" />
                    <p className='text-sm text-[var(--footer-link)]'>Thoughtfully curated stays in Hyderabad</p>
=======
        <div
            className='py-10 md:py-10 px-4 lg:px-8 bg-[color:var(--footer-bg)] text-[color:var(--footer-text)]'
        >
            <div className='max-w-screen-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8'>
                <div className='flex flex-col gap-7 items-center lg:items-start'>
                    <img className='w-32 md:w-20 rounded-md' src={logoSrc} alt="Payment provider" />
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
                    <div className='flex text-lg gap-6 text-[color:var(--footer-link)]'>
                        {socialLinks.map(({ icon, link }, index) => {
                            const IconComponent = iconMap[icon];
                            return (
                                <a key={index} href={link} target="_blank" rel="noopener noreferrer">
<<<<<<< HEAD
                                    <IconComponent className='hover:text-[var(--footer-link-hover)] duration-300 cursor-pointer' />
=======
                                    <IconComponent className='hover:text-[color:var(--footer-link-hover)] duration-300 cursor-pointer' />
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
                                </a>
                            );
                        })}
                    </div>
                </div>

                <div className='text-center lg:text-left'>
<<<<<<< HEAD
                    <h2 className='font-display text-xl font-semibold mb-4 text-[var(--footer-heading)]' style={{ fontFamily: 'var(--font-family-display)' }}>Quick Links</h2>
                    <div className='flex flex-col gap-2 text-base'>
                        {primaryNav.filter((item) => !item.hidden).map((item) => (
                            <Link key={item.label} to={item.to} className='text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors'>
                                {item.label}
                            </Link>
                        ))}
                        <Link to='/sitemap.xml' className='text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors'>Sitemap</Link>
=======
                    <h2 className='text-2xl font-semibold mb-4 text-[color:var(--footer-heading)]'>Quick Links</h2>
                    <div className='flex flex-col gap-2 text-base'>
                        {primaryNav.filter((item) => !item.hidden).map((item) => (
                            <Link key={item.label} to={item.to} className='text-[color:var(--footer-link)] hover:text-[color:var(--footer-link-hover)] transition-colors'>
                                {item.label}
                            </Link>
                        ))}
                        <Link to='/sitemap.xml' className='text-[color:var(--footer-link)] hover:text-[color:var(--footer-link-hover)] transition-colors'>Sitemap</Link>
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
                    </div>
                </div>

                <div className='text-center lg:text-left'>
<<<<<<< HEAD
                    <h2 className='font-display text-xl font-semibold mb-4 text-[var(--footer-heading)]' style={{ fontFamily: 'var(--font-family-display)' }}>More</h2>
                    <div className='flex flex-col gap-2 text-base'>
                        {moreNav.filter((item) => !item.hidden).map((item) => (
                            item.external ? (
                                <a key={item.label} href={item.to} target="_blank" rel="noopener noreferrer" className='text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors'>
                                    {item.label}
                                </a>
                            ) : (
                                <Link key={item.label} to={item.to} className='text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors'>
=======
                    <h2 className='text-2xl font-semibold mb-4 text-[color:var(--footer-heading)]'>More</h2>
                    <div className='flex flex-col gap-2 text-base'>
                        {moreNav.filter((item) => !item.hidden).map((item) => (
                            item.external ? (
                                <a key={item.label} href={item.to} target="_blank" rel="noopener noreferrer" className='text-[color:var(--footer-link)] hover:text-[color:var(--footer-link-hover)] transition-colors'>
                                    {item.label}
                                </a>
                            ) : (
                                <Link key={item.label} to={item.to} className='text-[color:var(--footer-link)] hover:text-[color:var(--footer-link-hover)] transition-colors'>
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
                                    {item.label}
                                </Link>
                            )
                        ))}
                    </div>
                </div>

                <div className="text-center lg:text-left">
<<<<<<< HEAD
                    <h2 className="font-display text-xl font-semibold mb-4 text-[var(--footer-heading)]" style={{ fontFamily: 'var(--font-family-display)' }}>Help</h2>
                    <div className="text-base flex flex-col gap-2">
                        {helpNav.map((item) => (
                            <Link key={item.label} to={item.to} className="text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors">
=======
                    <h2 className="text-2xl font-semibold mb-4 text-[color:var(--footer-heading)]">Help</h2>
                    <div className="text-base flex flex-col gap-2">
                        {helpNav.map((item) => (
                            <Link key={item.label} to={item.to} className="text-[color:var(--footer-link)] hover:text-[color:var(--footer-link-hover)] transition-colors">
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="text-center lg:text-left">
<<<<<<< HEAD
                    <h2 className="font-display text-xl font-semibold mb-4 text-[var(--footer-heading)]" style={{ fontFamily: 'var(--font-family-display)' }}>Locate Us</h2>
=======
                    <h2 className="text-2xl font-semibold mb-4 text-[color:var(--footer-heading)]">Locate Us</h2>
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
                    <div className="text-base flex flex-col gap-3">
                        {contactInfo.map(({ icon, text }, index) => {
                            const IconComponent = iconMap[icon];

                            return (
<<<<<<< HEAD
                                <div key={index} className="hover:text-[var(--footer-link-hover)] text-[var(--footer-link)] flex flex-col gap-2 cursor-pointer transition-colors">
=======
                                <div key={index} className="hover:text-[color:var(--footer-link-hover)] text-[color:var(--footer-link)] flex flex-col gap-2 cursor-pointer transition-colors">
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
                                    {Array.isArray(text) ? (
                                        text.map((line, idx) => (
                                            <p
                                                key={idx}
                                                className="flex gap-2 justify-center lg:justify-start items-center"
                                            >
                                                <span><IconComponent /></span>
                                                <span>{line}</span>
                                            </p>
                                        ))
                                    ) : (
                                        <p className="flex gap-2 justify-center lg:justify-start items-center">
                                            <span><IconComponent /></span>
                                            <span>{text}</span>
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

<<<<<<< HEAD
            <div className='flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-center mt-16 pt-8 border-t border-white/10 text-[var(--footer-link)]'>
                <div className='flex items-center gap-2 flex-wrap justify-center'>
                    <span>© 2025 Atlas Homes</span>
                    <span className='hidden sm:inline'>|</span>
                    <Link to="/policies" className='hover:text-[var(--footer-link-hover)] transition-colors'>Policies</Link>
                    <span>|</span>
                    <Link to="/terms" className='hover:text-[var(--footer-link-hover)] transition-colors'>Terms</Link>
                    <span>|</span>
                    <Link to="/contact" className='hover:text-[var(--footer-link-hover)] transition-colors'>Contact</Link>
=======
            <div className='flex flex-col sm:flex-row items-center justify-center gap-4 text-base text-center mt-10 text-[color:var(--footer-link)]'>
                <div className='flex items-center gap-2 flex-wrap justify-center'>
                    <span>© {new Date().getFullYear()} Atlas Homes</span>
                    <span className='hidden sm:inline'>|</span>
                    <Link to="/policies" className='hover:text-[color:var(--footer-link-hover)] transition-colors'>Policies</Link>
                    <span>|</span>
                    <Link to="/terms" className='hover:text-[color:var(--footer-link-hover)] transition-colors'>Terms</Link>
                    <span>|</span>
                    <Link to="/contact" className='hover:text-[color:var(--footer-link-hover)] transition-colors'>Contact</Link>
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
                </div>
                <div className='flex items-center'>
                    <span className='hidden sm:inline mr-2'>|</span>
                    <CompactThemeSwitcher />
                </div>
            </div>

<<<<<<< HEAD
        </footer>
=======
        </div>
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
    );
};

export default Footer;
