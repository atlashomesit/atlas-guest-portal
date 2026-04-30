import Slider from "../../components/homepage_components/slider/Slider";
import HomePage_Locations from "../../components/homepage_components/homepage_locations/HomePage_Locations";
import { useEffect } from "react";
import { propertyImages } from "../../data";
import { getTenantPropertyData } from "../../utils/propertyDataUtils";
import { getFaqHighlights } from "../../content/faqHighlights";
import { trackEvent } from "../../utils/analytics";
import BannerSecondary from "../../components/home/BannerSecondary";
import ServicesSection from "../../components/home/ServicesSection";
import TestimonialsSection from "../../components/home/TestimonialsSection";
import FooterCtaStrip from "../../components/home/FooterCtaStrip";
import SEO from "../../components/SEO";
import { LOGO_URL } from "../../config/branding";
import { sanitizeGuestImageUrl } from "../../utils/guestImageUrl";
import { CONTACT } from "../../config/contact";
import {
    enableFooterMiniCtaAboveFooter,
} from "../../config/homepageUxFlags";
import { useBooking } from "../../contexts/BookingContext";
import { useLocation } from "react-router-dom";
import FaqHighlights from "../../components/faq/FaqHighlights";
import pricingConfig from "../../config/pricing.config";
import { getEffectiveDiscountPercent } from "../../utils/pricing";

const Home = () => {
    const { pendingScrollTarget, setPendingScrollTarget } = useBooking();
    const location = useLocation();
    const propertyData = getTenantPropertyData();
    const primaryOgImage = sanitizeGuestImageUrl(propertyImages["101"]?.[0]) ?? LOGO_URL;
    const penthouse = propertyData.find((property) => property.id === 501);
    const penthouseCover = sanitizeGuestImageUrl(propertyImages["501"]?.[0]);
    const effectiveDiscountPercent = getEffectiveDiscountPercent();
    const penthouseOfferPrice = Math.round(
        pricingConfig.baseNightlyPriceByUnitType.penthouse *
            (1 - effectiveDiscountPercent / 100),
    );

    const faqHighlights = getFaqHighlights();
    const homepageJsonLd = [
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Atlas Homestays",
            url: "https://atlashomestays.com/",
            logo: LOGO_URL,
            description:
                "Serviced apartments in Hyderabad designed for business travel, family trips, and extended stays.",
            sameAs: [
                "https://www.facebook.com/profile.php?id=100040632723189",
                "https://www.instagram.com/atlashomeskphb/",
                "https://x.com/atlashomeskphb",
                "https://www.youtube.com/@atlashomestays",
            ],
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
            name: "Atlas Homestays",
            url: "https://atlashomestays.com/",
            logo: LOGO_URL,
            description:
                "Serviced apartments in KPHB, Hyderabad with Wi-Fi, parking, and responsive support for business and family stays.",
            slogan: "Best price on our website",
            telephone: `+91-${CONTACT.business.phone}`,
            email: "atlashomeskphb@gmail.com",
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
                url: "https://atlashomestays.com/",
                itemOffered: {
                    "@type": "Apartment",
                    name: "Atlas Penthouse 501",
                    description: penthouse?.property_description,
                    image: penthouseCover ?? LOGO_URL,
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
                    review: [
                        {
                            "@type": "Review",
                            reviewBody: "Spacious penthouse with reliable Wi-Fi and quick support during our workation.",
                            reviewRating: { "@type": "Rating", ratingValue: 5 },
                            author: { "@type": "Person", name: "Aparna" },
                        },
                        {
                            "@type": "Review",
                            reviewBody: "Loved the rooftop views and the smooth self check-in at Atlas Penthouse 501.",
                            reviewRating: { "@type": "Rating", ratingValue: 5 },
                            author: { "@type": "Person", name: "Ravi" },
                        },
                        {
                            "@type": "Review",
                            reviewBody: "Clean, modern interiors with plenty of space for our family of five.",
                            reviewRating: { "@type": "Rating", ratingValue: 4.8 },
                            author: { "@type": "Person", name: "Shruti" },
                        },
                    ],
                    offers: {
                        "@type": "Offer",
                        name: "Atlas Penthouse 501 direct offer",
                        priceCurrency: "INR",
                        price: penthouseOfferPrice,
                        availability: "https://schema.org/InStock",
                        validFrom: new Date().toISOString(),
                        url: "https://atlashomestays.com/",
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
    ];

    useEffect(() => {
        trackEvent("home_view", { surface: "home", listings: propertyData.length });
    }, []);

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
                title="Atlas Homestays | Serviced apartments in Hyderabad"
                description="Book serviced apartments in Hyderabad with business-ready amenities, flexible stays, and attentive on-call support from Atlas Homestays."
                image={primaryOgImage}
                url="https://atlashomestays.com/"
                twitterCard="summary_large_image"
                twitterSite="@atlashomeskphb"
                jsonLd={homepageJsonLd}
            />
            <section className="relative font-roboto select-none">
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
