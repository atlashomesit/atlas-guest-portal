/* eslint-disable atlas-brand/no-atlas-string-leak -- TODO Task 16: replace with per-tenant content */
import Slider from "../../components/homepage_components/slider/Slider";
import HomePage_Locations from "../../components/homepage_components/homepage_locations/HomePage_Locations";
import { useEffect, useMemo } from "react";
import { useTenantListings } from "../../hooks/useTenantListings";
import { getTenantOverrides, shouldHideAtlasBranding } from "../../tenant/tenantOverrides";
import { getTenantContext } from "../../tenant/tenantContext";
import { getFaqHighlights } from "../../content/faqHighlights";
import { trackEvent } from "../../utils/analytics";
import BannerSecondary from "../../components/home/BannerSecondary";
import ServicesSection from "../../components/home/ServicesSection";
import TestimonialsSection from "../../components/home/TestimonialsSection";
import FooterCtaStrip from "../../components/home/FooterCtaStrip";
import SEO from "../../components/SEO";
import { LOGO_URL } from "../../config/branding";
import { sanitizeGuestImageUrl } from "../../utils/guestImageUrl";
import { CONTACT, getContactEmail } from "../../config/contact";
import { getTenantBrandName } from "../../tenant/displayBrand";
import {
    enableFooterMiniCtaAboveFooter,
} from "../../config/homepageUxFlags";
import { useBooking } from "../../contexts/BookingContext";
import { Link, useLocation } from "react-router-dom";
import FaqHighlights from "../../components/faq/FaqHighlights";
import pricingConfig from "../../config/pricing.config";
import { getEffectiveDiscountPercent } from "../../utils/pricing";
import { getPublicSiteOrigin } from "../../config/siteOrigin";

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
    /** TASK-1293: marketplace shows by default; white-label opts in with directBookingPromo.enabled */
    const showDirectBookingPromo =
        overrides.directBookingPromo?.enabled === true ||
        (!hideAtlasBranding && overrides.directBookingPromo?.enabled !== false);
    const directPromoHeadline =
        overrides.directBookingPromo?.headline?.trim() ||
        (effectiveDiscountPercent > 0
            ? `Book direct — save up to ${Math.round(effectiveDiscountPercent)}% vs typical booking sites`
            : "Book direct — best rates on our official site");
    const directPromoSub =
        overrides.directBookingPromo?.subline?.trim() ||
        "Pay with UPI or cards via Razorpay. Your price is guaranteed at checkout.";
    const penthouseOfferPrice = Math.round(
        pricingConfig.baseNightlyPriceByUnitType.penthouse *
            (1 - effectiveDiscountPercent / 100),
    );

    const faqHighlights = getFaqHighlights();
    // CPO-007: derive canonical from the actual host (or VITE_PUBLIC_SITE_ORIGIN for SSR) so tenant
    // subdomains emit the right URL in JSON-LD instead of defaulting to the marketplace domain.
    const canonicalUrl = `${getPublicSiteOrigin()}/`;
    // Atlas social handles only published as sameAs when running under the Atlas brand.
    const atlasSocialSameAs = [
        "https://www.facebook.com/profile.php?id=100040632723189",
        "https://www.instagram.com/atlashomeskphb/",
        "https://x.com/atlashomeskphb",
        "https://www.youtube.com/@atlashomestays",
    ];
    const homepageJsonLd = useMemo(
        () => [
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: schemaBrandName,
            url: canonicalUrl,
            ...(schemaLogo ? { logo: schemaLogo } : {}),
            description:
                "Serviced apartments in Hyderabad designed for business travel, family trips, and extended stays.",
            ...(hideAtlasBranding ? {} : { sameAs: atlasSocialSameAs }),
            contactPoint: [
                {
                    "@type": "ContactPoint",
                    telephone: `+91-${CONTACT.business.phone}`,
                    contactType: "customer service",
                    areaServed: "IN",
                    availableLanguage: ["English"],
                },
            ],
        },
        {
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
            makesOffer: {
                "@type": "Offer",
                name: "Best price on our website",
                priceCurrency: "INR",
                price: penthouseOfferPrice,
                availability: "https://schema.org/InStock",
                url: canonicalUrl,
                itemOffered: {
                    "@type": "Apartment",
                    name: "Starguest House Penthouse 501",
                    description: penthouse?.property_description,
                    ...(penthouseCover ? { image: penthouseCover } : {}),
                    address: {
                        "@type": "PostalAddress",
                        streetAddress: "KPHB, Kukatpally",
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
                    aggregateRating: {
                        "@type": "AggregateRating",
                        ratingValue: penthouse?.property_rating,
                        reviewCount: penthouse?.property_reviews,
                    },
                    // TASK-2064: fabricated review array removed — violates Google Structured Data Guidelines and ASCI 2025
                    offers: {
                        "@type": "Offer",
                        name: "Starguest House Penthouse 501 direct offer",
                        priceCurrency: "INR",
                        price: penthouseOfferPrice,
                        availability: "https://schema.org/InStock",
                        validFrom: new Date().toISOString(),
                        url: canonicalUrl,
                        availableAtOrFrom: {
                            "@type": "Place",
                            address: {
                                "@type": "PostalAddress",
                                streetAddress: "KPHB, Kukatpally",
                                addressLocality: "Hyderabad",
                                addressRegion: "Telangana",
                                addressCountry: "IN",
                            },
                        },
                    },
                },
            },
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqHighlights.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
        },
    ],
        [
            contactEmail,
            faqHighlights,
            penthouse?.property_description,
            penthouse?.property_rating,
            penthouse?.property_reviews,
            penthouseCover,
            penthouseOfferPrice,
            schemaBrandName,
            schemaLogo,
            canonicalUrl,
            hideAtlasBranding,
        ],
    );

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
                    hideAtlasBranding && tenant?.name?.trim()
                        ? `${tenant.name.trim()} | Book your stay`
                        : "Starguest House | Serviced apartments in Hyderabad"
                }
                description={
                    hideAtlasBranding && tenant?.name?.trim()
                        ? `Book your stay with ${tenant.name.trim()}. Questions? Call ${CONTACT.business.phone} or email ${contactEmail}.`
                        : "Book serviced apartments in Hyderabad with business-ready amenities, flexible stays, and attentive on-call support from Starguest House."
                }
                image={primaryOgImage}
                url={canonicalUrl}
                twitterCard="summary_large_image"
                twitterSite="@starguesthouse"
                jsonLd={homepageJsonLd}
            />
            <section className="relative font-roboto select-none">
                {showDirectBookingPromo ? (
                    <div
                        className="border-b border-emerald-900/40 bg-emerald-950 px-4 py-2.5 text-center text-emerald-50"
                        data-testid="home-direct-booking-promo"
                        role="region"
                        aria-label="Direct booking savings"
                    >
                        <p className="text-sm font-semibold tracking-tight sm:text-base">{directPromoHeadline}</p>
                        <p className="mt-0.5 text-xs text-emerald-100/95 sm:text-sm">{directPromoSub}</p>
                        <Link
                            to="/"
                            state={{ scrollTo: "search-form" }}
                            className="mt-1 inline-block text-xs font-medium text-emerald-200 underline underline-offset-2 hover:text-white sm:text-sm"
                            data-testid="home-direct-booking-promo-dates"
                        >
                            Pick dates →
                        </Link>
                    </div>
                ) : null}
                <div className="w-full h-fit relative ">
                    <Slider />
                </div>
                <div>
                    <HomePage_Locations />
                </div>
                <BannerSecondary />
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
