/**
 * TASK-4914 / ADR-0081 D8 — "heritage" layout theme's Home page.
 *
 * Recovered composition (not stale logic): the section order/structure below is the
 * pre-coral Atlas homepage as it stood at `d1ab2590^` (before the "Sandstone Coral"
 * re-theme rewrote `src/pages/home/Home.tsx` in place — ADR-0081 amendment 2026-07-17
 * pt.4). All data-fetching, SEO/JSON-LD, tenant-branding, and analytics logic below is
 * the CURRENT shared implementation (untouched since `d1ab2590^`) — only the JSX layout
 * differs from the current `classic` (`src/pages/home/Home.tsx`): no `WaveDivider`
 * section separators and no "A note from your host" lavender callout panel (both were
 * additions of the coral redesign, not present pre-coral), and the "why book direct"
 * strip uses its original bordered/icon-chip presentation instead of the coral redesign's
 * centred/alternating-color-icon presentation. Every imported component below is the
 * current, shared one (`@/components/...`) — none are forked copies.
 */
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
import { getPublicSiteOrigin } from "../../config/siteOrigin";
import { buildHomepageJsonLd } from "../../pages/home/homepageJsonLd";

/* ---- Why-direct 2-pillar strip — heritage's original bordered/icon-chip presentation ---- */
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

const HeritageHome = () => {
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
    /** TASK-5194: white-label tenants must not assert Atlas-performed verification. */
    const whyDirectItems = useMemo(
        () => (hideAtlasBranding
            ? WHY_DIRECT_ITEMS.filter((item) => item.heading !== "We verify every home")
            : WHY_DIRECT_ITEMS),
        [hideAtlasBranding],
    );
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
                // TASK-4381/4386 / ADR-0068: internal (non-customer) tenants must never be indexed.
                // The global <InternalTenantRobotsMeta> (App.tsx) already injects the managed
                // noindex/nofollow tag on every route for internal tenants, so the home route must
                // NOT also pass `robots` here — doing so injects a SECOND <meta name="robots"> and
                // duplicates the tag (breaks the toHaveCount(1) contract). Per-page <SEO robots=…>
                // is reserved for draft-listing noindex only.
            />
            <section className="relative font-roboto select-none" data-testid="heritage-home">
                <div className="w-full h-fit relative ">
                    <Slider />
                </div>
                <AtlasNeighbourhoodRibbon />
                <div>
                    <HomePage_Locations />
                </div>
                <AtlasNeighbourhoodRibbon variant="closer" />

                {/* Why-direct 2-pillar strip — heritage's original bordered icon-chip presentation */}
                <section
                    className="border-t border-b border-border-subtle mt-0"
                    style={{ background: 'var(--bg-secondary, #f9f6f2)' }}
                    aria-labelledby="why-direct-heading"
                >
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                        <h2 id="why-direct-heading" className="sr-only">Why book direct</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {whyDirectItems.map((item) => (
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

export default HeritageHome;
