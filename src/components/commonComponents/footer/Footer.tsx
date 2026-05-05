import type { ReactNode } from 'react';
import { FaFacebook, FaTwitter, FaYoutube, FaInstagram, FaMapMarkerAlt, FaWhatsapp } from 'react-icons/fa';
import { ImGithub } from 'react-icons/im';
import { IoIosMail, IoIosCall, IoIosArrowForward } from "react-icons/io";
import { footerData } from '../../../data';
import { Link } from 'react-router-dom';
import { helpNav, moreNav, primaryNav } from '../../../config/navigation';
import { LOGO_URL } from '../../../config/branding';
import { getTenantContext } from '../../../tenant/tenantContext';
import { getTenantOverrides } from '../../../tenant/tenantOverrides';
import { CompactThemeSwitcher } from '../../ui/CompactThemeSwitcher';
import { formatDisplayNumber, getContactEmail, getTelLink, getWhatsAppLink, getContactPhone, getWhatsAppPhone } from '../../../config/contact';

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
    FaFacebook: `Visit ${getTenantContext()?.name ?? 'us'} on Facebook`,
    FaInstagram: `Visit ${getTenantContext()?.name ?? 'us'} on Instagram`,
    FaTwitter: `Visit ${getTenantContext()?.name ?? 'us'} on X`,
    FaYoutube: `Visit ${getTenantContext()?.name ?? 'us'} on YouTube`,
    ImGithub: `Visit ${getTenantContext()?.name ?? 'us'} on GitHub`,
};

const Footer = () => {
    const tenant = getTenantContext();
    const overrides = getTenantOverrides(tenant?.slug);
    const logoSrc = overrides.hideLogo ? "" : (tenant?.logoUrl ?? LOGO_URL);
    const showLogo = Boolean(logoSrc);
    const footerBrand = overrides.hideAtlasHomesBranding ? (tenant?.name?.trim() || "Guest stays") : "Atlas Homes";
    const footerTagline = overrides.hideAtlasHomesBranding
        ? (tenant?.tagline?.trim() || "Comfortable stays with responsive support.")
        : "Thoughtfully curated stays in Hyderabad";
    const year = new Date().getFullYear();

    const socialLinks = Array.isArray(footerData?.socialLinks) ? footerData.socialLinks : [];

    const businessPhone = getContactPhone("business");
    const whatsappDigits = getWhatsAppPhone("business");
    const showWhatsAppRow = whatsappDigits !== businessPhone;
    const email = getContactEmail();

    type LocateRow = { key: string; icon: ReactNode; content: ReactNode };
    const locateRows: LocateRow[] = [];
    if (overrides.contact?.address?.trim()) {
        locateRows.push({
            key: "address",
            icon: <FaMapMarkerAlt className="mt-0.5 shrink-0 text-lg" aria-hidden />,
            content: <span className="text-left">{overrides.contact.address.trim()}</span>,
        });
    }
    locateRows.push({
        key: "email",
        icon: <IoIosMail className="shrink-0 text-xl" aria-hidden />,
        content: (
            <a href={`mailto:${encodeURIComponent(email)}`} className="break-all text-left hover:text-[var(--footer-link-hover)]">
                {email}
            </a>
        ),
    });
    locateRows.push({
        key: "phone",
        icon: <IoIosCall className="shrink-0 text-xl" aria-hidden />,
        content: (
            <a href={getTelLink()} className="text-left hover:text-[var(--footer-link-hover)]">
                {formatDisplayNumber()}
            </a>
        ),
    });
    if (showWhatsAppRow) {
        locateRows.push({
            key: "whatsapp",
            icon: <FaWhatsapp className="shrink-0 text-lg" aria-hidden />,
            content: (
                <a
                    href={getWhatsAppLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-left hover:text-[var(--footer-link-hover)]"
                >
                    WhatsApp +91-{whatsappDigits}
                </a>
            ),
        });
    }

    return (
        <footer
            className='bg-bg-muted border-t border-border-subtle py-16 md:py-20 px-4 sm:px-6 lg:px-8'
            style={{ background: 'var(--footer-bg)' }}
        >
            <div className='w-full max-w-7xl mx-auto'>
                {/* Main Footer Content Grid */}
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12 mb-12'>
                    {/* Left Section - Brand */}
                    <div className='flex flex-col items-center md:items-start space-y-6'>
                        {showLogo && (
                            <img className='w-28 h-auto rounded-lg' src={logoSrc} alt="" aria-hidden loading="lazy" decoding="async" />
                        )}
                        <div className='space-y-3'>
                            <p className='text-sm text-text-muted leading-relaxed max-w-xs'>{footerTagline}</p>
                            {tenant?.isGstVerified && (
                                <span className='inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1' title='This property manager has a verified GSTIN on file'>
                                    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' className='w-3.5 h-3.5' aria-hidden='true'><path fillRule='evenodd' d='M16.403 12.652a3 3 0 0 0 0-5.304 3 3 0 0 0-3.75-3.751 3 3 0 0 0-5.305 0 3 3 0 0 0-3.751 3.751 3 3 0 0 0 0 5.305 3 3 0 0 0 3.751 3.75 3 3 0 0 0 5.305 0 3 3 0 0 0 3.75-3.75Zm-2.546-4.46a.75.75 0 0 0-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z' clipRule='evenodd'/></svg>
                                    GST Verified
                                </span>
                            )}
                        </div>
                        {/* RA-006: white-label tenants must not show Atlas's social profiles. */}
                        {!overrides.hideAtlasHomesBranding && (
                            <div className='flex gap-5 text-lg text-text-muted pt-2'>
                                {socialLinks.map(({ icon, link }, index) => {
                                    const IconComponent = iconMap[icon];
                                    const ariaLabel = socialLabelByIcon[icon] ?? "Open social profile";
                                    return (
                                        <a
                                            key={index}
                                            href={link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={ariaLabel}
                                            title={ariaLabel}
                                            className='text-text-muted hover:text-text-primary transition-colors duration-250'
                                        >
                                            <IconComponent className='w-5 h-5' />
                                        </a>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Navigation Columns */}
                    <div className='flex flex-col items-center md:items-start space-y-4'>
                        <h3 className='text-sm font-semibold text-text-primary tracking-wider uppercase'>Quick Links</h3>
                        <nav className='flex flex-col gap-3 w-full'>
                            {primaryNav.filter((item) => !item.hidden).map((item) => (
                                <Link key={item.label} to={item.to} className='text-sm text-text-muted hover:text-text-primary transition-colors duration-250 relative group w-fit'>
                                    {item.label}
                                    <span className='absolute bottom-0 left-0 w-0 h-0.5 bg-brand-primary group-hover:w-full transition-all duration-250'></span>
                                </Link>
                            ))}
                            <Link to='/sitemap.xml' className='text-sm text-text-muted hover:text-text-primary transition-colors duration-250 relative group w-fit'>
                                Sitemap
                                <span className='absolute bottom-0 left-0 w-0 h-0.5 bg-brand-primary group-hover:w-full transition-all duration-250'></span>
                            </Link>
                        </nav>
                    </div>

                    <div className='flex flex-col items-center md:items-start space-y-4'>
                        <h3 className='text-sm font-semibold text-text-primary tracking-wider uppercase'>More</h3>
                        <nav className='flex flex-col gap-3 w-full'>
                            {moreNav.filter((item) => !item.hidden).map((item) => (
                                item.external ? (
                                    <a key={item.label} href={item.to} target="_blank" rel="noopener noreferrer" className='text-sm text-text-muted hover:text-text-primary transition-colors duration-250 relative group w-fit'>
                                        {item.label}
                                        <span className='absolute bottom-0 left-0 w-0 h-0.5 bg-brand-primary group-hover:w-full transition-all duration-250'></span>
                                    </a>
                                ) : (
                                    <Link key={item.label} to={item.to} className='text-sm text-text-muted hover:text-text-primary transition-colors duration-250 relative group w-fit'>
                                        {item.label}
                                        <span className='absolute bottom-0 left-0 w-0 h-0.5 bg-brand-primary group-hover:w-full transition-all duration-250'></span>
                                    </Link>
                                )
                            ))}
                        </nav>
                    </div>

                    <div className='flex flex-col items-center md:items-start space-y-4'>
                        <h3 className='text-sm font-semibold text-text-primary tracking-wider uppercase'>Help</h3>
                        <nav className='flex flex-col gap-3 w-full'>
                            {helpNav.map((item) => (
                                <Link key={item.label} to={item.to} className='text-sm text-text-muted hover:text-text-primary transition-colors duration-250 relative group w-fit'>
                                    {item.label}
                                    <span className='absolute bottom-0 left-0 w-0 h-0.5 bg-brand-primary group-hover:w-full transition-all duration-250'></span>
                                </Link>
                            ))}
                        </nav>
                    </div>

                    {/* Right Section - Contact */}
                    <div className='flex flex-col items-center md:items-start space-y-4'>
                        <h3 className='text-sm font-semibold text-text-primary tracking-wider uppercase'>Locate Us</h3>
                        <ul className='flex flex-col gap-4 w-full list-none'>
                            {locateRows.map((row) => (
                                <li key={row.key} className='flex items-start gap-3'>
                                    <span className='text-text-muted shrink-0 flex-shrink-0 mt-0.5'>{row.icon}</span>
                                    <span className='text-sm text-text-muted leading-relaxed min-w-0'>{row.content}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Footer Bottom */}
                <div className='flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-border-subtle'>
                    <div className='flex items-center justify-center sm:justify-start gap-2 text-xs text-text-muted flex-wrap'>
                        <span>© {year} {footerBrand}</span>
                        <span className='hidden sm:inline text-border-subtle'>·</span>
                        <Link to="/policies" className='hover:text-text-primary transition-colors duration-250'>Policies</Link>
                        <span className='text-border-subtle'>·</span>
                        <Link to="/terms" className='hover:text-text-primary transition-colors duration-250'>Terms</Link>
                        <span className='text-border-subtle'>·</span>
                        <Link to="/privacy" className='hover:text-text-primary transition-colors duration-250'>Privacy</Link>
                        <span className='text-border-subtle'>·</span>
                        <Link to="/contact" className='hover:text-text-primary transition-colors duration-250'>Contact</Link>
                    </div>
                    <div className='flex items-center'>
                        <CompactThemeSwitcher />
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
