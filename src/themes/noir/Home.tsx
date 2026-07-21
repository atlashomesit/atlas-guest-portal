/**
 * TASK-4906 / ADR-0081 D8 — "noir" layout theme's Home page.
 *
 * Founder-specified visual direction (ATLAS-DEVELOPER-TASKS.md TASK-4906): "dark luxury
 * noir" — nocturnal palette, gold accents, full-bleed imagery, minimal chrome; dark
 * backgrounds, a high-contrast photography-forward hero, restrained UI chrome around
 * booking/search. The composition below is genuinely different from `classic`'s
 * `Slider`-based split hero (ivory editorial column + photo panel) and from `heritage`'s
 * recovered pre-coral layout: a single edge-to-edge hero photograph with a dark scrim,
 * no persistent search-bar chrome above the fold beyond one restrained glass card, and no
 * decorative ribbon strip.
 *
 * All data-fetching, SEO/JSON-LD, tenant-branding, and analytics logic below reuses the
 * CURRENT shared implementation verbatim (`@/hooks`, `@/tenant`, `@/utils`, `@/components`,
 * `@/contexts`) — nothing here forks booking/payment/listing-data logic (ADR-0081 D1; this
 * task's stop-and-ask). The booking/search entry point is the real, shared
 * `SearchAvailabilityWidget` (the same component `classic`'s `Slider` uses), not a
 * re-implementation.
 */
import './Home.css';
import HomePage_Locations from '../../components/homepage_components/homepage_locations/HomePage_Locations';
import { useEffect, useMemo } from 'react';
import { useTenantListings } from '../../hooks/useTenantListings';
import { getTenantOverrides, shouldHideAtlasBranding } from '../../tenant/tenantOverrides';
import { getTenantContext } from '../../tenant/tenantContext';
import { getFaqHighlights } from '../../content/faqHighlights';
import { trackEvent } from '../../utils/analytics';
import ServicesSection from '../../components/home/ServicesSection';
import TestimonialsSection from '../../components/home/TestimonialsSection';
import FooterCtaStrip from '../../components/home/FooterCtaStrip';
import SEO from '../../components/SEO';
import { LOGO_URL } from '../../config/branding';
import { HERO_IMAGE_URL } from '../../config/hero';
import { sanitizeGuestImageUrl } from '../../utils/guestImageUrl';
import { CONTACT, getContactEmail } from '../../config/contact';
import { getTenantBrandName } from '../../tenant/displayBrand';
import { enableFooterMiniCtaAboveFooter } from '../../config/homepageUxFlags';
import { useBooking } from '../../contexts/BookingContext';
import { useLocation } from 'react-router-dom';
import { SearchAvailabilityWidget } from '../../components/availability/SearchAvailabilityWidget';
import FaqHighlights from '../../components/faq/FaqHighlights';
import pricingConfig from '../../config/pricing.config';
import { getEffectiveDiscountPercent } from '../../utils/pricing';
import { getPublicSiteOrigin } from '../../config/siteOrigin';

/* ---- Value strip — noir's minimal icon+copy presentation (no bordered card chrome) ---- */
const NOIR_VALUE_ITEMS = [
    {
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
            </svg>
        ),
        heading: 'Every address, verified',
        body: 'The photographs on this page are the rooms you will walk into — nothing staged, nothing borrowed.',
    },
    {
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" />
                <path d="M16 12h6v4h-6a2 2 0 0 1 0-4z" />
            </svg>
        ),
        heading: 'Pay the host, directly',
        body: 'No platform mark-up, no third-party fee. The price on this page is the price you pay.',
    },
] as const;

const ATLAS_SOCIAL_SAME_AS = [
    'https://www.facebook.com/profile.php?id=100040632723189',
    // eslint-disable-next-line atlas-brand/no-atlas-string-leak -- Atlas platform social; guarded by hideAtlasBranding above
    'https://www.instagram.com/atlashomeskphb/',
    // eslint-disable-next-line atlas-brand/no-atlas-string-leak -- Atlas platform social; guarded by hideAtlasBranding above
    'https://x.com/atlashomeskphb',
    // eslint-disable-next-line atlas-brand/no-atlas-string-leak -- Atlas platform social; guarded by hideAtlasBranding above
    'https://www.youtube.com/@atlashomestays',
];

const NoirHome = () => {
    const { pendingScrollTarget, setPendingScrollTarget } = useBooking();
    const location = useLocation();
    const { properties: propertyData } = useTenantListings();
    const tenant = getTenantContext();
    const overrides = getTenantOverrides(tenant?.slug);
    const hideAtlasBranding = shouldHideAtlasBranding(tenant, overrides);
    const schemaBrandName = getTenantBrandName();
    const schemaLogo = overrides.hideLogo ? undefined : sanitizeGuestImageUrl(overrides.logoUrl ?? tenant?.logoUrl) ?? LOGO_URL;
    const contactEmail = getContactEmail();
    const penthouse = propertyData.find((property) => property.id === 501);
    const room101Cover = sanitizeGuestImageUrl(propertyData.find((property) => property.id === 101)?.property_img?.[0]);
    const primaryOgImage = room101Cover ?? (!overrides.hideLogo ? LOGO_URL : undefined);
    const penthouseCover = sanitizeGuestImageUrl(penthouse?.property_img?.[0]) ?? (!overrides.hideLogo ? LOGO_URL : undefined);
    const effectiveDiscountPercent = getEffectiveDiscountPercent();
    const penthouseOfferPrice = Math.round(
        pricingConfig.baseNightlyPriceByUnitType.penthouse * (1 - effectiveDiscountPercent / 100),
    );

    // Full-bleed hero photo: the same allowlisted, public-read listing photo used by
    // `classic`'s `Slider` — reused verbatim (ADR-0081 D1: never fork imagery/data sourcing),
    // hidden for white-label tenants pending a per-tenant heroImageUrl (RA-006, same rule
    // Slider follows).
    const showAtlasContent = !hideAtlasBranding;
    const heroImageUrl = showAtlasContent ? HERO_IMAGE_URL : '';
    const hasHeroPhoto = Boolean(heroImageUrl.trim());
    const heroPhotoAriaLabel = showAtlasContent
        ? `A warm, owner-run ${schemaBrandName} living room in KPHB, shown at night`
        : `Welcome to ${schemaBrandName}`;

    const faqHighlights = getFaqHighlights();
    const canonicalUrl = `${getPublicSiteOrigin()}/`;
    const homepageJsonLd = useMemo(() => {
        const organization = {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: schemaBrandName,
            url: canonicalUrl,
            ...(schemaLogo ? { logo: schemaLogo } : {}),
            description: hideAtlasBranding
                ? `Book your stay with ${schemaBrandName}.`
                : 'Serviced apartments in Hyderabad designed for business travel, family trips, and extended stays.',
            ...(hideAtlasBranding ? {} : { sameAs: ATLAS_SOCIAL_SAME_AS }),
            contactPoint: [
                {
                    '@type': 'ContactPoint',
                    telephone: `+91-${CONTACT.business.phone}`,
                    contactType: 'customer service',
                    areaServed: 'IN',
                    availableLanguage: ['English'],
                },
            ],
        };

        const lodgingBusiness = hideAtlasBranding
            ? null
            : {
                '@context': 'https://schema.org',
                '@type': ['LodgingBusiness', 'Hotel'],
                name: schemaBrandName,
                url: canonicalUrl,
                ...(schemaLogo ? { logo: schemaLogo } : {}),
                description:
                    'Serviced apartments in KPHB, Hyderabad with Wi-Fi, parking, and responsive support for business and family stays.',
                slogan: 'Best price on our website',
                telephone: `+91-${CONTACT.business.phone}`,
                email: contactEmail,
                address: {
                    '@type': 'PostalAddress',
                    streetAddress: 'KPHB, Kukatpally',
                    addressLocality: 'Hyderabad',
                    addressRegion: 'Telangana',
                    addressCountry: 'IN',
                },
                amenityFeature: [
                    { '@type': 'LocationFeatureSpecification', name: 'High-speed Wi-Fi', value: true },
                    { '@type': 'LocationFeatureSpecification', name: 'On-site parking', value: true },
                    { '@type': 'LocationFeatureSpecification', name: 'Air conditioning', value: true },
                    { '@type': 'LocationFeatureSpecification', name: 'Work-friendly desks', value: true },
                ],
                checkinTime: '14:00',
                checkoutTime: '11:00',
                ...(penthouse ? {
                    makesOffer: {
                        '@type': 'Offer',
                        name: 'Best price on our website',
                        priceCurrency: 'INR',
                        price: penthouseOfferPrice,
                        availability: 'https://schema.org/InStock',
                        url: canonicalUrl,
                        itemOffered: {
                            '@type': 'Apartment',
                            name: `${schemaBrandName} | Penthouse Suite 501`,
                            description: penthouse.property_description,
                            ...(penthouseCover ? { image: penthouseCover } : {}),
                            address: {
                                '@type': 'PostalAddress',
                                streetAddress: penthouse.property_location ?? 'KPHB, Kukatpally',
                                addressLocality: 'Hyderabad',
                                addressRegion: 'Telangana',
                                addressCountry: 'IN',
                            },
                            occupancy: { '@type': 'QuantitativeValue', maxValue: 6, unitCode: 'C62' },
                            amenityFeature: [
                                { '@type': 'LocationFeatureSpecification', name: 'Wi-Fi', value: true },
                                { '@type': 'LocationFeatureSpecification', name: 'Air conditioning', value: true },
                                { '@type': 'LocationFeatureSpecification', name: 'Full kitchen', value: true },
                                { '@type': 'LocationFeatureSpecification', name: 'Workspace', value: true },
                                { '@type': 'LocationFeatureSpecification', name: 'Swimming pool access', value: true },
                            ],
                            offers: {
                                '@type': 'Offer',
                                name: `${schemaBrandName} | Penthouse Suite 501 direct offer`,
                                priceCurrency: 'INR',
                                price: penthouseOfferPrice,
                                availability: 'https://schema.org/InStock',
                                validFrom: new Date().toISOString(),
                                url: canonicalUrl,
                                availableAtOrFrom: {
                                    '@type': 'Place',
                                    address: {
                                        '@type': 'PostalAddress',
                                        streetAddress: penthouse.property_location ?? 'KPHB, Kukatpally',
                                        addressLocality: 'Hyderabad',
                                        addressRegion: 'Telangana',
                                        addressCountry: 'IN',
                                    },
                                },
                            },
                        },
                    },
                } : {}),
            };

        const faqPage = {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqHighlights.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
        };

        return lodgingBusiness ? [organization, lodgingBusiness, faqPage] : [organization, faqPage];
    }, [
        contactEmail,
        faqHighlights,
        penthouse,
        penthouseCover,
        penthouseOfferPrice,
        schemaBrandName,
        schemaLogo,
        canonicalUrl,
        hideAtlasBranding,
    ]);

    useEffect(() => {
        trackEvent('home_view', { surface: 'home', listings: propertyData.length });
    }, [propertyData.length]);

    useEffect(() => {
        const target = pendingScrollTarget || (location.state as { scrollTo?: string } | null)?.scrollTo;
        if (target !== 'search-form') return;

        const scrollToForm = () => {
            const form = document.getElementById('search-form');
            if (form) {
                form.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            setPendingScrollTarget(null);
        };

        const timer = window.setTimeout(scrollToForm, 120);
        return () => window.clearTimeout(timer);
    }, [location.state, pendingScrollTarget, setPendingScrollTarget]);

    return (
        <>
            <SEO
                title={
                    hideAtlasBranding
                        ? `${schemaBrandName} | Book your stay`
                        : `${schemaBrandName} | Find your perfect stay`
                }
                description={
                    hideAtlasBranding
                        ? `Book your stay with ${schemaBrandName}. Questions? Call ${CONTACT.business.phone} or email ${contactEmail}.`
                        : `Book serviced apartments with ${schemaBrandName}. Flexible stays, business-ready amenities, and attentive support.`
                }
                image={primaryOgImage}
                url={canonicalUrl}
                twitterCard="summary_large_image"
                // eslint-disable-next-line atlas-brand/no-atlas-string-leak -- Atlas marketplace Twitter handle; guarded by hideAtlasBranding (undefined on white-label tenants)
                twitterSite={hideAtlasBranding ? undefined : '@atlashomestays'}
                jsonLd={homepageJsonLd}
            />
            <section className="noir-home font-roboto select-none" data-testid="noir-home">
                {/* Full-bleed hero — a single edge-to-edge photograph, dark scrim, minimal chrome:
                    no split editorial column, no persistent nav-bar treatment above the fold
                    beyond one restrained search card. */}
                <div className="noir-hero" data-testid="noir-hero">
                    {hasHeroPhoto ? (
                        <div
                            className="noir-hero-photo"
                            style={{ backgroundImage: `url("${heroImageUrl}")` }}
                            role="img"
                            aria-label={heroPhotoAriaLabel}
                        />
                    ) : (
                        <div
                            className="noir-hero-photo"
                            style={{ backgroundImage: 'var(--gradient-hero)' }}
                            aria-hidden="true"
                        />
                    )}
                    <div className="noir-hero-scrim" aria-hidden="true" data-testid="noir-hero-scrim" />
                    <div className="noir-hero-content">
                        <span className="noir-eyebrow">{schemaBrandName}</span>
                        <h1 className="noir-hero-h1">
                            After dark, <em>the city is yours</em>
                        </h1>
                        <p className="noir-hero-sub">
                            {showAtlasContent
                                ? 'Owner-run homes in KPHB, kept immaculate and always ready — book direct, arrive to a home that is genuinely yours for the night.'
                                : `Direct from the owner — no platform fee, verified addresses, and responsive support from ${schemaBrandName}.`}
                        </p>
                        <div id="search-form" data-testid="hero-widget" className="noir-hero-widget">
                            <SearchAvailabilityWidget />
                        </div>
                    </div>
                </div>

                <div className="noir-section">
                    <HomePage_Locations />
                </div>

                {/* Value strip — minimal icon+copy presentation, no bordered card chrome */}
                <section className="noir-value-strip" aria-labelledby="noir-why-direct-heading">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                        <h2 id="noir-why-direct-heading" className="sr-only">Why book direct</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {NOIR_VALUE_ITEMS.map((item) => (
                                <div key={item.heading} className="noir-value-item">
                                    <span className="noir-value-icon" aria-hidden="true">{item.icon}</span>
                                    <h3 className="noir-value-heading">{item.heading}</h3>
                                    <p className="noir-value-body">{item.body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="noir-section">
                    <ServicesSection />
                </div>
                <div className="noir-section px-4 lg:px-20 py-8">
                    <FaqHighlights />
                </div>
                <div className="noir-section">
                    <TestimonialsSection />
                </div>
                {enableFooterMiniCtaAboveFooter && <FooterCtaStrip />}
            </section>
        </>
    );
};

export default NoirHome;
