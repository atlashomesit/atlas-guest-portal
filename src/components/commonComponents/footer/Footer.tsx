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
            className='py-16 md:py-20 px-[5%] text-[var(--footer-text)] border-t border-white/10'
            style={{ background: 'var(--footer-bg)' }}
        >
            <div className='max-w-luxury mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12'>
                <div className='flex flex-col gap-4 items-center lg:items-start'>
                    {showLogo && (
                        <img className='w-32 md:w-24 rounded-md' src={logoSrc} alt="" aria-hidden loading="lazy" decoding="async" />
                    )}
                    <p className='text-sm text-[var(--footer-link)]'>{footerTagline}</p>
                    {tenant?.isGstVerified && (
                        <span className='inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 border border-emerald-400/40 rounded-full px-2.5 py-0.5' title='This property manager has a verified GSTIN on file'>
                            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' className='w-3.5 h-3.5' aria-hidden='true'><path fillRule='evenodd' d='M16.403 12.652a3 3 0 0 0 0-5.304 3 3 0 0 0-3.75-3.751 3 3 0 0 0-5.305 0 3 3 0 0 0-3.751 3.751 3 3 0 0 0 0 5.305 3 3 0 0 0 3.751 3.75 3 3 0 0 0 5.305 0 3 3 0 0 0 3.75-3.75Zm-2.546-4.46a.75.75 0 0 0-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z' clipRule='evenodd'/></svg>
                            GST Verified
                        </span>
                    )}
                    <div className='flex text-lg gap-6 text-[color:var(--footer-link)]'>
                        {socialLinks.map(({ icon, link }, index) => {
                            const IconComponent = iconMap[icon];
                            const baseLabel = socialLabelByIcon[icon] ?? "Open social profile";
                            const ariaLabel = overrides.hideAtlasHomesBranding
                                ? baseLabel.replace(/Atlas Homestays/g, footerBrand)
                                : baseLabel;
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

                <div className="text-center lg:text-left min-w-0">
                    <h2 className="font-display text-xl font-semibold mb-4 text-[var(--footer-heading)]" style={{ fontFamily: 'var(--font-family-display)' }}>Locate Us</h2>
                    <ul className="m-0 flex list-none flex-col gap-3 p-0 text-base text-[var(--footer-link)]">
                        {locateRows.map((row) => (
                            <li key={row.key} className="flex flex-row items-start justify-center gap-3 lg:justify-start">
                                <span className="text-[var(--footer-link)] shrink-0 leading-relaxed">{row.icon}</span>
                                <span className="min-w-0 flex-1 leading-relaxed">{row.content}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className='flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-center mt-16 pt-8 border-t border-white/10 text-[var(--footer-link)]'>
                <div className='flex items-center gap-2 flex-wrap justify-center'>
                    <span>
                        © {year} {footerBrand}
                    </span>
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
