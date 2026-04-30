import { FaFacebook, FaTwitter, FaYoutube, FaInstagram } from 'react-icons/fa';
import { ImGithub } from 'react-icons/im';
import { IoIosMail, IoIosCall, IoIosArrowForward } from "react-icons/io";
import { footerData } from '../../../data';
import { Link } from 'react-router-dom';
import { helpNav, moreNav, primaryNav } from '../../../config/navigation';
import { LOGO_URL } from '../../../config/branding';
import { CompactThemeSwitcher } from '../../ui/CompactThemeSwitcher';
import { formatDisplayNumber, getContactEmail } from '../../../config/contact';

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

const socialLabelByIcon: Record<string, string> = {
    FaFacebook: 'Visit Atlas Homestays on Facebook',
    FaInstagram: 'Visit Atlas Homestays on Instagram',
    FaTwitter: 'Visit Atlas Homestays on X',
    FaYoutube: 'Visit Atlas Homestays on YouTube',
    ImGithub: 'Visit Atlas Homestays on GitHub',
};

const Footer = () => {
    const socialLinks = Array.isArray(footerData?.socialLinks) ? footerData.socialLinks : [];
    const contactInfo: { icon: keyof typeof iconMap; text: string | string[] }[] = [
        { icon: 'IoIosMail', text: getContactEmail() },
        { icon: 'IoIosCall', text: [formatDisplayNumber()] },
    ];
    const logoSrc = LOGO_URL;

    return (
        <footer
            className='py-16 md:py-20 px-[5%] text-[var(--footer-text)] border-t border-white/10'
            style={{ background: 'var(--footer-bg)' }}
        >
            <div className='max-w-luxury mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12'>
                <div className='flex flex-col gap-4 items-center lg:items-start'>
                    <img className='w-32 md:w-24 rounded-md' src={logoSrc} alt="Atlas Homestays" />
                    <p className='text-sm text-[var(--footer-link)]'>Thoughtfully curated stays in Hyderabad</p>                    <div className='flex text-lg gap-6 text-[color:var(--footer-link)]'>
                        {socialLinks.map(({ icon, link }, index) => {
                            const IconComponent = iconMap[icon];
                            const ariaLabel = socialLabelByIcon[icon] ?? 'Open social profile';
                            return (
                                <a
                                    key={index}
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={ariaLabel}
                                    title={ariaLabel}
                                >
                                    <IconComponent className='hover:text-[var(--footer-link-hover)] duration-300 cursor-pointer' />
                                </a>
                            );
                        })}
                    </div>
                </div>

                <div className='text-center lg:text-left'>
                    <h2 className='font-display text-xl font-semibold mb-4 text-[var(--footer-heading)]' style={{ fontFamily: 'var(--font-family-display)' }}>Quick Links</h2>
                    <div className='flex flex-col gap-2 text-base'>
                        {primaryNav.filter((item) => !item.hidden).map((item) => (
                            <Link key={item.label} to={item.to} className='text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors'>
                                {item.label}
                            </Link>
                        ))}
                        <Link to='/sitemap.xml' className='text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors'>Sitemap</Link>                    </div>
                </div>

                <div className='text-center lg:text-left'>
                    <h2 className='font-display text-xl font-semibold mb-4 text-[var(--footer-heading)]' style={{ fontFamily: 'var(--font-family-display)' }}>More</h2>
                    <div className='flex flex-col gap-2 text-base'>
                        {moreNav.filter((item) => !item.hidden).map((item) => (
                            item.external ? (
                                <a key={item.label} href={item.to} target="_blank" rel="noopener noreferrer" className='text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors'>
                                    {item.label}
                                </a>
                            ) : (
                                <Link key={item.label} to={item.to} className='text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors'>                                    {item.label}
                                </Link>
                            )
                        ))}
                    </div>
                </div>

                <div className="text-center lg:text-left">
                    <h2 className="font-display text-xl font-semibold mb-4 text-[var(--footer-heading)]" style={{ fontFamily: 'var(--font-family-display)' }}>Help</h2>
                    <div className="text-base flex flex-col gap-2">
                        {helpNav.map((item) => (
                            <Link key={item.label} to={item.to} className="text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors">                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="text-center lg:text-left">
                    <h2 className="font-display text-xl font-semibold mb-4 text-[var(--footer-heading)]" style={{ fontFamily: 'var(--font-family-display)' }}>Locate Us</h2>                    <div className="text-base flex flex-col gap-3">
                        {contactInfo.map(({ icon, text }, index) => {
                            const IconComponent = iconMap[icon];

                            return (
                                <div key={index} className="hover:text-[var(--footer-link-hover)] text-[var(--footer-link)] flex flex-col gap-2 cursor-pointer transition-colors">                                    {Array.isArray(text) ? (
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

            <div className='flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-center mt-16 pt-8 border-t border-white/10 text-[var(--footer-link)]'>
                <div className='flex items-center gap-2 flex-wrap justify-center'>
                    <span>© 2025 Atlas Homes</span>
                    <span className='hidden sm:inline'>|</span>
                    <Link to="/policies" className='hover:text-[var(--footer-link-hover)] transition-colors'>Policies</Link>
                    <span>|</span>
                    <Link to="/terms" className='hover:text-[var(--footer-link-hover)] transition-colors'>Terms</Link>
                    <span>|</span>
                    <Link to="/privacy" className='hover:text-[var(--footer-link-hover)] transition-colors'>Privacy</Link>
                    <span>|</span>
                    <Link to="/contact" className='hover:text-[var(--footer-link-hover)] transition-colors'>Contact</Link>                </div>
                <div className='flex items-center'>
                    <span className='hidden sm:inline mr-2'>|</span>
                    <CompactThemeSwitcher />
                </div>
            </div>

        </footer>    );
};

export default Footer;
