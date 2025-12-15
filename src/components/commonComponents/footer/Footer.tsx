import logo from '../../../assets/logo.svg';
import { FaFacebook, FaTwitter, FaYoutube, FaInstagram } from 'react-icons/fa';
import { ImGithub } from 'react-icons/im';
import { IoIosMail, IoIosCall, IoIosArrowForward } from "react-icons/io";
import { footerData } from '../../../data';
import { Link } from 'react-router-dom';

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
    const logoSrc = logo;

    return (
        <div className='py-10 md:py-10 px-4 lg:px-8 bg-black text-[#949494]'>
            <div className='max-w-screen-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8'>
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
                    <h2 className='text-2xl text-primary font-semibold mb-4'>Navigate</h2>
                    <div className='flex flex-col gap-2 text-base'>
                        <Link to='/apartments' className='hover:text-white'>Apartments</Link>
                        <Link to='/blog' className='hover:text-white'>Blog</Link>
                        <Link to='/blog/guest-guides' className='hover:text-white'>Guest Guides</Link>
                        <Link to='/blog/hospitality-tech' className='hover:text-white'>Hospitality Tech & AI</Link>
                        <Link to='/policies' className='hover:text-white'>Policies</Link>
                        <Link to='/contact' className='hover:text-white'>Contact</Link>
                        <a href='/sitemap.xml' className='hover:text-white'>Sitemap</a>
                    </div>
                </div>

                <div className="text-center lg:text-left">
                    <h2 className="text-2xl text-primary font-semibold mb-4">Policies</h2>
                    <div className="text-base flex flex-col gap-2">
                        <Link to="/policies#cancellation" className="hover:text-white">Cancellation</Link>
                        <Link to="/policies#house-rules" className="hover:text-white">House Rules</Link>
                        <Link to="/policies#amenities" className="hover:text-white">Amenities</Link>
                        <Link to="/policies#payment" className="hover:text-white">Payment</Link>
                        <Link to="/policies#liability" className="hover:text-white">Liability</Link>
                    </div>
                </div>

                <div className="text-center lg:text-left">
                    <h2 className="text-2xl text-primary font-semibold mb-4">Locate Us</h2>
                    <div className="text-base flex flex-col gap-3">
                        {contactInfo.map(({ icon, text }, index) => {
                            const IconComponent = iconMap[icon];

                            return (
                                <div key={index} className="hover:text-white flex flex-col gap-2 cursor-pointer">
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

            <div className='text-base text-slate-300 text-center mt-10'>
                © 2025 The Atlas Homes All rights reserved | <Link to="/policies" className='hover:text-white'>Policies</Link> | <Link to="/contact" className='hover:text-white'>Contact</Link>
            </div>

        </div>
    );
};

export default Footer;
