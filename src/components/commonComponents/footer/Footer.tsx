import { FaFacebook, FaTwitter, FaYoutube, FaInstagram } from 'react-icons/fa';
import { ImGithub } from 'react-icons/im';
import { IoIosMail, IoIosCall, IoIosArrowForward } from "react-icons/io";
import { footerData } from '../../../data';
import { Link } from 'react-router-dom';
import { helpNav, moreNav, primaryNav } from '../../../config/navigation';
import { LOGO_URL } from '../../../config/branding';

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
        <div
            className='py-10 md:py-10 px-4 lg:px-8 bg-[color:var(--text-primary)] text-[color:color-mix(in_srgb,var(--text-contrast)_72%,transparent)]'
        >
            <div className='max-w-screen-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8'>
                <div className='flex flex-col gap-7 items-center lg:items-start'>
                    <img className='w-32 md:w-20 rounded-md' src={logoSrc} alt="paymentlogo" />
                    <div className='flex text-lg gap-6'>
                        {socialLinks.map(({ icon, link }, index) => {
                            const IconComponent = iconMap[icon];
                            return (
                                <a key={index} href={link} target="_blank" rel="noopener noreferrer">
                                    <IconComponent className='hover:text-primary duration-300 cursor-pointer' />
                                </a>
                            );
                        })}
                    </div>
                </div>

                <div className='text-center lg:text-left'>
                    <h2 className='text-2xl text-primary font-semibold mb-4'>Quick Links</h2>
                    <div className='flex flex-col gap-2 text-base'>
                        {primaryNav.filter((item) => !item.hidden).map((item) => (
                            <Link key={item.label} to={item.to} className='hover:text-[var(--text-contrast)]'>
                                {item.label}
                            </Link>
                        ))}
                        <a href='/sitemap.xml' className='hover:text-[var(--text-contrast)]'>Sitemap</a>
                    </div>
                </div>

                <div className='text-center lg:text-left'>
                    <h2 className='text-2xl text-primary font-semibold mb-4'>More</h2>
                    <div className='flex flex-col gap-2 text-base'>
                        {moreNav.filter((item) => !item.hidden).map((item) => (
                            item.external ? (
                                <a key={item.label} href={item.to} target="_blank" rel="noopener noreferrer" className='hover:text-[var(--text-contrast)]'>
                                    {item.label}
                                </a>
                            ) : (
                                <Link key={item.label} to={item.to} className='hover:text-[var(--text-contrast)]'>
                                    {item.label}
                                </Link>
                            )
                        ))}
                    </div>
                </div>

                <div className="text-center lg:text-left">
                    <h2 className="text-2xl text-primary font-semibold mb-4">Help</h2>
                    <div className="text-base flex flex-col gap-2">
                        {helpNav.map((item) => (
                            <Link key={item.label} to={item.to} className="hover:text-[var(--text-contrast)]">
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="text-center lg:text-left">
                    <h2 className="text-2xl text-primary font-semibold mb-4">Locate Us</h2>
                    <div className="text-base flex flex-col gap-3">
                        {contactInfo.map(({ icon, text }, index) => {
                            const IconComponent = iconMap[icon];

                            return (
                                <div key={index} className="hover:text-[var(--text-contrast)] flex flex-col gap-2 cursor-pointer">
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

            <div className='text-base text-center mt-10 text-[color:color-mix(in_srgb,var(--text-contrast)_70%,transparent)]'>
                © 2025 The Atlas Homes All rights reserved | <Link to="/policies" className='hover:text-[var(--text-contrast)]'>Policies</Link> | <Link to="/terms" className='hover:text-[var(--text-contrast)]'>Terms</Link> | <Link to="/contact" className='hover:text-[var(--text-contrast)]'>Contact</Link>
            </div>

        </div>
    );
};

export default Footer;
