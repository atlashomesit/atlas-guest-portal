import type { ReactNode } from 'react';
import { FaFacebook, FaTwitter, FaYoutube, FaInstagram, FaMapMarkerAlt, FaWhatsapp } from 'react-icons/fa';
import { ImGithub } from 'react-icons/im';
import { IoIosMail, IoIosCall, IoIosArrowForward } from "react-icons/io";
import { footerData } from '../../../data';
import { Link } from 'react-router-dom';
import { helpNav, moreNav, primaryNav } from '../../../config/navigation';
import { LOGO_URL } from '../../../config/branding';
import { getTenantContext } from '../../../tenant/tenantContext';
import { hasOnlinePaymentRail } from '../../../tenant/paymentRail';
import { getTenantBrandName } from '../../../tenant/displayBrand';
import { getTenantOverrides, shouldHideAtlasBranding } from '../../../tenant/tenantOverrides';
import { formatDisplayNumber, getContactEmail, getTelLink, getWhatsAppLink, getGuestFacingPhone, getWhatsAppPhone } from '../../../config/contact';

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
    const tenant = getTenantContext();
    const brandName = getTenantBrandName();
    const socialLabelByIcon: Record<string, string> = {
        FaFacebook: `Visit ${brandName} on Facebook`,
        FaInstagram: `Visit ${brandName} on Instagram`,
        FaTwitter: `Visit ${brandName} on X`,
        FaYoutube: `Visit ${brandName} on YouTube`,
        ImGithub: `Visit ${brandName} on GitHub`,
    };
    // TASK-7428: gate only the payment-processor half of the TASK-4161 MOR disclosure.
    const showPaymentProcessorCredit = hasOnlinePaymentRail(tenant);
    const overrides = getTenantOverrides(tenant?.slug);
    const hideAtlasBranding = shouldHideAtlasBranding(tenant, overrides);
    const logoSrc = overrides.hideLogo ? "" : (overrides.logoUrl ?? tenant?.logoUrl ?? LOGO_URL);
    const showLogo = Boolean(logoSrc);
    // RA-006 §3.5: footer brand always prefers the tenant's own name. Atlas-specific
    // copy is reached only on the Atlas marketplace root where hideAtlasBranding=false.
    const footerBrand = brandName;
    const footerTagline = hideAtlasBranding
        ? (tenant?.tagline?.trim() || "Comfortable stays with responsive support.")
        : (tenant?.tagline?.trim() || "Thoughtfully curated stays in Hyderabad");
    const year = new Date().getFullYear();

    const socialLinks = Array.isArray(footerData?.socialLinks) ? footerData.socialLinks : [];

    // TASK-7192: single guest-facing phone so tel: matches the WhatsApp booking handoff.
    const businessPhone = getGuestFacingPhone("business");
    const whatsappDigits = getWhatsAppPhone("business");
    const showWhatsAppRow = Boolean(whatsappDigits) && whatsappDigits !== businessPhone;
    const email = getContactEmail();

    type LocateRow = { key: string; icon: ReactNode; content: ReactNode };
    const locateRows: LocateRow[] = [];
    if (overrides.contact?.address?.trim()) {
        locateRows.push({
            key: "address",
            icon: <FaMapMarkerAlt className="shrink-0 text-base" aria-hidden />,
            content: <span className="text-left">{overrides.contact.address.trim()}</span>,
        });
    }
    if (email) {
        locateRows.push({
            key: "email",
            icon: <IoIosMail className="shrink-0 text-lg" aria-hidden />,
            content: (
                <a href={`mailto:${email}`} className="break-all text-left hover:text-[var(--footer-link-hover)]">
                    {email}
                </a>
            ),
        });
    }
    if (businessPhone) {
        locateRows.push({
            key: "phone",
            icon: <IoIosCall className="shrink-0 text-lg" aria-hidden />,
            content: (
                <a href={getTelLink()} className="text-left hover:text-[var(--footer-link-hover)]">
                    {formatDisplayNumber()}
                </a>
            ),
        });
    }
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
            className='pt-16 md:pt-20 pb-28 md:pb-24 px-[5%] text-[var(--footer-text)] border-t border-white/10'
            style={{ background: 'var(--footer-bg)' }}
        >
            <div className='max-w-luxury mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10 lg:items-start'>
                <div className='flex flex-col gap-3 items-center lg:items-start'>
                    {showLogo && (
                        <img
                            className={`rounded-md object-contain ${logoSrc.includes('stay-bycityfocus') ? 'w-24 md:w-28 bg-[#fff8e7] p-2.5' : 'w-28 md:w-24'}`}
                            src={logoSrc}
                            alt={footerBrand}
                            loading="lazy"
                            decoding="async"
                        />
                    )}
                    <p className='text-sm leading-relaxed text-[var(--footer-link)]'>{footerTagline}</p>
                    {tenant?.isGstVerified && (
                        <span className='inline-flex items-center gap-1.5 text-xs font-medium text-[var(--support-success-text)] border border-[color:color-mix(in_srgb,var(--support-success-text)_40%,transparent)] rounded-full px-2.5 py-0.5' title='This property manager has a verified GSTIN on file'>
                            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' className='w-3.5 h-3.5' aria-hidden='true'><path fillRule='evenodd' d='M16.403 12.652a3 3 0 0 0 0-5.304 3 3 0 0 0-3.75-3.751 3 3 0 0 0-5.305 0 3 3 0 0 0-3.751 3.751 3 3 0 0 0 0 5.305 3 3 0 0 0 3.751 3.75 3 3 0 0 0 5.305 0 3 3 0 0 0 3.75-3.75Zm-2.546-4.46a.75.75 0 0 0-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z' clipRule='evenodd'/></svg>
                            GST Verified
                        </span>
                    )}
                    {/* RA-006: white-label tenants must not show Atlas's social profiles. */}
                    {!hideAtlasBranding && (
                        <div className='flex text-lg gap-6 text-[color:var(--footer-link)]'>
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
                                    >
                                        <IconComponent className='hover:text-[var(--footer-link-hover)] duration-300 cursor-pointer' />
                                    </a>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className='text-center lg:text-left'>
                    <h2 className='font-display text-lg font-semibold mb-3 text-[var(--footer-heading)] leading-tight' style={{ fontFamily: 'var(--font-family-display)' }}>Quick Links</h2>
                    <div className='flex flex-col gap-2 text-base'>
                        {primaryNav.filter((item) => !item.hidden).map((item) => (
                            <Link key={item.label} to={item.to} className='text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors'>
                                {item.label}
                            </Link>
                        ))}
                        <Link to='/sitemap' className='text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors'>Sitemap</Link>                    </div>
                </div>

                <div className='text-center lg:text-left'>
                    <h2 className='font-display text-lg font-semibold mb-3 text-[var(--footer-heading)] leading-tight' style={{ fontFamily: 'var(--font-family-display)' }}>More</h2>
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
                    <h2 className="font-display text-lg font-semibold mb-3 text-[var(--footer-heading)] leading-tight" style={{ fontFamily: 'var(--font-family-display)' }}>Help</h2>
                    <div className="text-base flex flex-col gap-2">
                        {helpNav.map((item) => (
                            <Link key={item.label} to={item.to} className="text-[var(--footer-link)] hover:text-[var(--footer-link-hover)] transition-colors">                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="text-center lg:text-left min-w-0">
                    <h2 className="font-display text-lg font-semibold mb-3 text-[var(--footer-heading)] leading-tight" style={{ fontFamily: 'var(--font-family-display)' }}>Locate Us</h2>
                    <ul className="m-0 flex list-none flex-col gap-3 p-0 text-base text-[var(--footer-link)]">
                        {locateRows.map((row) => (
                            <li key={row.key} className="flex flex-row items-center justify-center gap-3 lg:justify-start">
                                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[var(--footer-link)] [&_svg]:block">
                                    {row.icon}
                                </span>
                                <span className="min-w-0 flex-1 leading-snug text-left">{row.content}</span>
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
            </div>

            {/* TASK-4161: Consumer Protection (E-Commerce) Rules 2020 disclosure — custom-domain
                white-label tenants only. Must show: merchant-of-record legal name, grievance
                contact, booking-engine credit, and Razorpay payment processor credit. */}
            {tenant?.legalContactPack?.isCustomDomain && (
                <div
                    data-testid="mor-disclosure"
                    className='mt-8 pt-6 border-t border-white/10 text-xs text-[var(--footer-link)] text-center space-y-1'
                >
                    <p>
                        Trade name:{' '}
                        <strong>{tenant.legalContactPack.displayName ?? footerBrand}</strong>
                        {' · '}
                        Legal name:{' '}
                        <strong>{tenant.legalContactPack.legalName ?? footerBrand}</strong>.
                    </p>
                    <p>
                        Bookings on this site are fulfilled by{' '}
                        <strong>{tenant.legalContactPack.legalName ?? footerBrand}</strong>.
                        {(tenant.legalContactPack.contactEmail || businessPhone) && (
                            <span>
                                {' '}Contact:{' '}
                                {tenant.legalContactPack.contactEmail && (
                                    <a
                                        href={`mailto:${encodeURIComponent(tenant.legalContactPack.contactEmail)}`}
                                        className='hover:text-[var(--footer-link-hover)] transition-colors'
                                    >
                                        {tenant.legalContactPack.contactEmail}
                                    </a>
                                )}
                                {tenant.legalContactPack.contactEmail && businessPhone && ' · '}
                                {businessPhone && (
                                    <a
                                        href={getTelLink()}
                                        className='hover:text-[var(--footer-link-hover)] transition-colors'
                                    >
                                        {formatDisplayNumber()}
                                    </a>
                                )}
                            </span>
                        )}
                    </p>
                    {/* TASK-4161 disclosure, TASK-7428 partial gate: the booking-engine credit is
                        unconditional (Atlas PMS runs this site either way). The payment-processor
                        credit is a statement about how the guest's money moves, so it renders only
                        when an online gateway actually takes the payment — on a WhatsApp-handoff /
                        pay-on-arrival tenant no payment is processed on this site, and naming a
                        processor there is itself a misleading representation rather than a
                        required disclosure. */}
                    <p>
                        Booking engine by <strong>Atlas PMS</strong>
                        {showPaymentProcessorCredit && (
                            <> · Payments secured by <strong>Razorpay</strong></>
                        )}
                    </p>
                </div>
            )}

        </footer>    );
};

export default Footer;
