/**
 * TASK-4907 / ADR-0081 D8 — "coastal" layout theme's Home page.
 *
 * Founder-specified visual direction (epic §3.1/§3.9, ADR-0081 D8): "light sea-blue
 * palette, horizontal gallery layouts, wave-motif accents — an airy, coastal-stay
 * register." The hero, trust strip, services, FAQ, testimonials, and footer sections all
 * compose the CURRENT shared components unchanged (same data-fetching, SEO/JSON-LD,
 * tenant-branding, and analytics logic as `classic`/`heritage` — none forked). The one
 * genuinely new page-level composition is the listings section: `CoastalListingsGallery`
 * (horizontal scroll-snap gallery) replaces `classic`'s uniform grid (`HomePage_Locations`)
 * for this layout only, per the founder's explicit "horizontal gallery layouts (as opposed
 * to the default's grid/card composition)" instruction — see that file's own header comment
 * for why this is composition, not a booking/listing-fetch fork.
 */
import Slider from "../../components/homepage_components/slider/Slider";
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
import { getPublicSiteOrigin } from "../../config/siteOrigin";
import { buildHomepageJsonLd } from "../../pages/home/homepageJsonLd";
import CoastalWaveDivider from "./CoastalWaveDivider";
import CoastalListingsGallery from "./ListingsGallery";
import "./coastal.css";

/* ---- Why-direct 2-pillar strip — same static copy as classic/heritage (content, not logic) ---- */
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
        body: "The host keeps more when you book direct. Price shown includes room rate, GST, and a 3% payment-processing fee.",
    },
] as const;

const CoastalHome = () => {
    const { pendingScrollTarget, setPendingScrollTarget } = useBooking();
    const location = useLocation();
    const { properties: propertyData } = useTenantListings();
    const tenant = getTenantContext();
    const overrides = getTenantOverrides(tenant?.slug);
    const hideAtlasBranding = shouldHideAtlasBranding(tenant, overrides);
    /** CPO-001 / SEO: never emit a wrong hardcoded brand in JSON-LD — use resolved tenant or marketplace baseline. */
    const schemaBrandName = getTenantBrandName();
    const schemaLogo = overrides.hideLogo ? undefined : sanitizeGuestImageUrl(overrides.logoUrl ?? tenant?.logoUrl) ?? LOGO_URL;
    const contactEmail = getContactEmail();
    const room101Cover = sanitizeGuestImageUrl(propertyData.find((property) => property.id === 101)?.property_img?.[0]);
    const primaryOgImage = room101Cover ?? (!overrides.hideLogo ? LOGO_URL : undefined);
    const listingAddress = propertyData.find((property) => property.property_location?.trim())?.property_location?.trim();
    /** TASK-5194 / TASK-7428: white-label — no Atlas verification claim, no invented 3% fee. */
    const whyDirectItems = useMemo(() => {
        if (!hideAtlasBranding) return [...WHY_DIRECT_ITEMS];
        return WHY_DIRECT_ITEMS
            .filter((item) => item.heading !== "We verify every home")
            .map((item) =>
                item.heading === "You pay the host directly"
                    ? {
                        ...item,
                        body: "Book direct with the host. The total shown at checkout is what you pay — no surprise OTA markups.",
                    }
                    : item,
            );
    }, [hideAtlasBranding]);

    const faqHighlights = getFaqHighlights();
    // CPO-007: derive canonical from the actual host (or VITE_PUBLIC_SITE_ORIGIN for SSR) so tenant
    // subdomains emit the right URL in JSON-LD instead of defaulting to the marketplace domain.
    const canonicalUrl = `${getPublicSiteOrigin()}/`;
    const homepageJsonLd = useMemo(
        () =>
            buildHomepageJsonLd({
                schemaBrandName,
                schemaLogo,
                canonicalUrl,
                contactEmail,
                hideAtlasBranding,
                faqHighlights,
                listingAddress,
            }),
        [schemaBrandName, schemaLogo, canonicalUrl, contactEmail, hideAtlasBranding, faqHighlights, listingAddress],
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
                twitterSite={hideAtlasBranding ? undefined : "@atlashomestays"}
                jsonLd={homepageJsonLd}
            />
            <section className="relative font-roboto select-none" data-testid="coastal-home">
                <div className="w-full h-fit relative ">
                    <Slider />
                </div>
                <CoastalWaveDivider className="px-[5%] md:px-[12%] -mt-1" />
                <AtlasNeighbourhoodRibbon />

                {/* Horizontal gallery — coastal's own composition, replaces classic's grid. */}
                <CoastalListingsGallery />

                <CoastalWaveDivider flip />
                <AtlasNeighbourhoodRibbon variant="closer" />

                {/* Why-direct 2-pillar strip */}
                <section
                    className="mt-0"
                    style={{ background: "var(--bg-primary, #f2fbfd)" }}
                    aria-labelledby="why-direct-heading"
                >
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-14">
                        <h2 id="why-direct-heading" className="sr-only">Why book direct</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                            {whyDirectItems.map((item) => (
                                <div key={item.heading} className="flex flex-col items-center text-center gap-3 max-w-xs mx-auto">
                                    <span
                                        className="inline-flex items-center justify-center w-12 h-12"
                                        style={{ color: "var(--brand-primary, #0e7490)" }}
                                        aria-hidden="true"
                                    >
                                        {item.icon}
                                    </span>
                                    <h3
                                        className="text-xl md:text-2xl font-medium"
                                        style={{ color: "var(--text-primary, #082f3a)", letterSpacing: "-0.005em", lineHeight: "1.2" }}
                                    >
                                        {item.heading}
                                    </h3>
                                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary, #082f3a)" }}>{item.body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <CoastalWaveDivider className="px-[10%]" />
                <div className="">
                    <ServicesSection />
                </div>
                <div className="px-4 lg:px-20 py-8" style={{ background: "var(--bg-primary, #f2fbfd)" }}>
                    <FaqHighlights />
                </div>
                <div className="">
                    <TestimonialsSection />
                </div>
                {enableFooterMiniCtaAboveFooter && (
                    <FooterCtaStrip />
                )}
                <CoastalWaveDivider className="px-[6%]" flip />
            </section>
        </>
    );
};

export default CoastalHome;
