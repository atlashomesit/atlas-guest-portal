/* eslint-disable atlas-brand/no-atlas-string-leak -- TODO Task 16: replace with per-tenant content */
import Slider from "../../components/homepage_components/slider/Slider";
import HomePage_Locations from "../../components/homepage_components/homepage_locations/HomePage_Locations";
import { useEffect, useMemo } from "react";
import { useTenantListings } from "../../hooks/useTenantListings";
import { getTenantOverrides, shouldHideAtlasBranding } from "../../tenant/tenantOverrides";
import { getTenantContext } from "../../tenant/tenantContext";
import { getFaqHighlights } from "../../content/faqHighlights";
import { trackEvent } from "../../utils/analytics";
import ServicesSection from "../../components/home/ServicesSection";
import TestimonialsSection from "../../components/home/TestimonialsSection";
import FooterCtaStrip from "../../components/home/FooterCtaStrip";
import AtlasNeighbourhoodRibbon from "../../components/home/AtlasNeighbourhoodRibbon";
import SEO from "../../components/SEO";
import { LOGO_URL } from "../../config/branding";
import { sanitizeGuestImageUrl } from "../../utils/guestImageUrl";
import { CONTACT, getContactEmail } from "../../config/contact";
import { getTenantBrandName } from "../../tenant/displayBrand";
import {
    enableFooterMiniCtaAboveFooter,
} from "../../config/homepageUxFlags";
import { useBooking } from "../../contexts/BookingContext";
import { useLocation } from "react-router-dom";
import FaqHighlights from "../../components/faq/FaqHighlights";
import pricingConfig from "../../config/pricing.config";
import { getEffectiveDiscountPercent } from "../../utils/pricing";
import { getPublicSiteOrigin } from "../../config/siteOrigin";

/* ---- Why-direct 3-pillar strip — Home v2 design §5 ---- */
const WHY_DIRECT_ITEMS = [
    {
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
            </svg>
        ),
        heading: "We verify every home",
        body: "Every address is one we own and operate. The photos on this page are the rooms you'll walk into.",
    },
    {
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1"/>
                <path d="M16 12h6v4h-6a2 2 0 0 1 0-4z"/>
            </svg>
        ),
        heading: "You pay the host directly",
        body: "No platform mark-up, no third-party booking fee. The price you see is the price you pay.",
    },
    {
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2"/>
                <path d="M3 10h18M8 3v4M16 3v4"/>
            </svg>
        ),
        heading: "Free cancellation 48h before",
        body: "Plans change. Cancel up to 48 hours before check-in and we'll refund the full amount, no questions.",
    },
] as const;

// Atlas social handles only published as sameAs when running under the Atlas brand.
const ATLAS_SOCIAL_SAME_AS = [
    "https://www.facebook.com/profile.php?id=100040632723189",
    "https://www.instagram.com/atlashomeskphb/",
    "https://x.com/atlashomeskphb",
    "https://www.youtube.com/@atlashomestays",
];

const Home = () => {
    const { pendingScrollTarget, setPendingScrollTarget } = useBooking();
    const location = useLocation();
    const { properties: propertyData } = useTenantListings();
    const tenant = getTenantContext();
    const overrides = getTenantOverrides(tenant?.slug);
    const hideAtlasBranding = shouldHideAtlasBranding(tenant, overrides);
    /** CPO-001 / SEO: never emit a wrong hardcoded brand in JSON-LD — use resolved tenant or marketplace baseline. */
    const schemaBrandName = getTenantBrandName();
    const schemaLogo = overrides.hideLogo ? undefined : sanitizeGuestImageUrl(tenant?.logoUrl) ?? LOGO_URL;
    const contactEmail = getContactEmail();
    const penthouse = propertyData.find((property) => property.id === 501);
    const room101Cover = sanitizeGuestImageUrl(propertyData.find((property) => property.id === 101)?.property_img?.[0]);
    const primaryOgImage = room101Cover ?? (!overrides.hideLogo ? LOGO_URL : undefined);
    const penthouseCover = sanitizeGuestImageUrl(penthouse?.property_img?.[0]) ?? (!overrides.hideLogo ? LOGO_URL : undefined);
    const effectiveDiscountPercent = getEffectiveDiscountPercent();
    /** TASK-1293 / TASK-1944: direct-booking strip lives in Slider (below hero search), not above the hero. */
    const penthouseOfferPrice = Math.round(
        pricingConfig.baseNightlyPriceByUnitType.penthouse *
            (1 - effectiveDiscountPercent / 100),
    );

    const faqHighlights = getFaqHighlights();
    // CPO-007: derive canonical from the actual host (or VITE_PUBLIC_SITE_ORIGIN for SSR) so tenant
    // subdomains emit the right URL in JSON-LD instead of defaulting to the marketplace domain.
    const canonicalUrl = `${getPublicSiteOrigin()}/`;
    const homepageJsonLd = useMemo(() => {
        const organization = {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: schemaBrandName,
            url: canonicalUrl,
            ...(schemaLogo ? { logo: schemaLogo } : {}),
            description: hideAtlasBranding
                ? `Book your stay with ${schemaBrandName}.`
                : "Serviced apartments in Hyderabad designed for business travel, family trips, and extended stays.",
            ...(hideAtlasBranding ? {} : { sameAs: ATLAS_SOCIAL_SAME_AS }),
            contactPoint: [
                {
                    "@type": "ContactPoint",
                    telephone: `+91-${CONTACT.business.phone}`,
                    contactType: "customer service",
                    areaServed: "IN",
                    availableLanguage: ["English"],
                },
            ],
        };

        // TASK-2900: Atlas-specific address / Penthouse offer must not ship on white-label tenants.
        const lodgingBusiness = hideAtlasBranding
            ? null
            : {
                "@context": "https://schema.org",
                "@type": ["LodgingBusiness", "Hotel"],
                name: schemaBrandName,
                url: canonicalUrl,
                ...(schemaLogo ? { logo: schemaLogo } : {}),
                description:
                    "Serviced apartments in KPHB, Hyderabad with Wi-Fi, parking, and responsive support for business and family stays.",
                slogan: "Best price on our website",
                telephone: `+91-${CONTACT.business.phone}`,
                email: contactEmail,
                address: {
                    "@type": "PostalAddress",
                    streetAddress: "KPHB, Kukatpally",
                    addressLocality: "Hyderabad",
                    addressRegion: "Telangana",
                    addressCountry: "IN",
                },
                amenityFeature: [
                    { "@type": "LocationFeatureSpecification", name: "High-speed Wi-Fi", value: true },
                    { "@type": "LocationFeatureSpecification", name: "On-site parking", value: true },
                    { "@type": "LocationFeatureSpecification", name: "Air conditioning", value: true },
                    { "@type": "LocationFeatureSpecification", name: "Work-friendly desks", value: true },
                ],
                checkinTime: "14:00",
                checkoutTime: "11:00",
                ...(penthouse ? {
                    makesOffer: {
                        "@type": "Offer",
                        name: "Best price on our website",
                        priceCurrency: "INR",
                        price: penthouseOfferPrice,
                        availability: "https://schema.org/InStock",
                        url: canonicalUrl,
                        itemOffered: {
                            "@type": "Apartment",
                            name: `${schemaBrandName} | Penthouse Suite 501`,
                            description: penthouse.property_description,
                            ...(penthouseCover ? { image: penthouseCover } : {}),
                            address: {
                                "@type": "PostalAddress",
                                streetAddress: penthouse.property_address ?? "KPHB, Kukatpally",
                                addressLocality: "Hyderabad",
                                addressRegion: "Telangana",
                                addressCountry: "IN",
                            },
                            occupancy: {
                                "@type": "QuantitativeValue",
                                maxValue: 6,
                                unitCode: "C62",
                            },
                            amenityFeature: [
                                { "@type": "LocationFeatureSpecification", name: "Wi-Fi", value: true },
                                { "@type": "LocationFeatureSpecification", name: "Air conditioning", value: true },
                                { "@type": "LocationFeatureSpecification", name: "Full kitchen", value: true },
                                { "@type": "LocationFeatureSpecification", name: "Workspace", value: true },
                                { "@type": "LocationFeatureSpecification", name: "Swimming pool access", value: true },
                            ],
                            offers: {
                                "@type": "Offer",
                                name: `${schemaBrandName} | Penthouse Suite 501 direct offer`,
                                priceCurrency: "INR",
                                price: penthouseOfferPrice,
                                availability: "https://schema.org/InStock",
                                validFrom: new Date().toISOString(),
                                url: canonicalUrl,
                                availableAtOrFrom: {
                                    "@type": "Place",
                                    address: {
                                        "@type": "PostalAddress",
                                        streetAddress: penthouse.property_address ?? "KPHB, Kukatpally",
                                        addressLocality: "Hyderabad",
                                        addressRegion: "Telangana",
                                        addressCountry: "IN",
                                    },
                                },
                            },
                        },
                    },
                } : {}),
            };

        const faqPage = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqHighlights.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
        };

        return lodgingBusiness
            ? [organization, lodgingBusiness, faqPage]
            : [organization, faqPage];
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
        trackEvent("home_view", { surface: "home", listings: propertyData.length });
    }, [propertyData.length]);

    useEffect(() => {
        const target = pendingScrollTarget || (location.state as { scrollTo?: string } | null)?.scrollTo;
        if (target !== "search-form") return;

        const scrollToForm = () => {
            const form = document.getElementById("search-form");
            if (form) {
                form.scrollIntoView({ behavior: "smooth", block: "start" });
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
                twitterSite={hideAtlasBranding ? undefined : "@atlashomestays"}
                jsonLd={homepageJsonLd}
            />
            <section className="relative font-roboto select-none">
                <div className="w-full h-fit relative ">
                    <Slider />
                </div>
                <AtlasNeighbourhoodRibbon />
                <div>
                    <HomePage_Locations />
                </div>
                <AtlasNeighbourhoodRibbon variant="closer" />

                {/* Why-direct 3-pillar strip — Home v2 design §5 */}
                <section
                    className="border-t border-b border-border-subtle mt-0"
                    style={{ background: 'var(--bg-secondary, #f9f6f2)' }}
                    aria-labelledby="why-direct-heading"
                >
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                        <h2 id="why-direct-heading" className="sr-only">Why book direct</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                            {WHY_DIRECT_ITEMS.map((item) => (
                                <div key={item.heading} className="flex flex-col gap-3">
                                    <span
                                        className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-border-subtle"
                                        style={{ background: '#fff', color: 'var(--brand-primary, #ea580c)' }}
                                        aria-hidden="true"
                                    >
                                        {item.icon}
                                    </span>
                                    <h3
                                        className="text-2xl font-medium text-text-primary"
                                        style={{ fontFamily: 'var(--font-family-display)', letterSpacing: '-0.005em', lineHeight: '1.15' }}
                                    >
                                        {item.heading}
                                    </h3>
                                    <p className="text-sm text-text-muted leading-relaxed">{item.body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="">
                    <ServicesSection />
                </div>
                <div className="px-4 lg:px-20 py-8">
                    <FaqHighlights />
                </div>
                <div className="">
                    <TestimonialsSection />
                </div>
                {enableFooterMiniCtaAboveFooter && (
                    <FooterCtaStrip />
                )}
            </section>
        </>
    );
};

export default Home;
