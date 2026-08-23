import Slider from "../../components/homepage_components/slider/Slider";
import HomePage_Locations from "../../components/homepage_components/homepage_locations/HomePage_Locations";
import { lazy, Suspense, useEffect, useMemo } from "react";
import { useTenantListings } from "../../hooks/useTenantListings";
import { getTenantOverrides, shouldHideAtlasBranding } from "../../tenant/tenantOverrides";
import { getTenantContext } from "../../tenant/tenantContext";
import { directBookingPriceClaim } from "../../tenant/paymentRail";
import { getFaqHighlights } from "../../content/faqHighlights";
import { trackEvent } from "../../utils/analytics";
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
import WaveDivider from "../../components/ui/WaveDivider";
import { getPublicSiteOrigin } from "../../config/siteOrigin";
import { buildHomepageJsonLd } from "./homepageJsonLd";

const ServicesSection = lazy(() => import("../../components/home/ServicesSection"));
const TestimonialsSection = lazy(() => import("../../components/home/TestimonialsSection"));
const FooterCtaStrip = lazy(() => import("../../components/home/FooterCtaStrip"));
const FaqHighlights = lazy(() => import("../../components/faq/FaqHighlights"));

/* ---- Why-direct 2-pillar strip — Home v2 design §5 ---- */
const WHY_DIRECT_ITEMS_ATLAS = [
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
        // Body is replaced at render via directBookingPriceClaim (TASK-8055).
        body: "",
    },
] as const;

/** TASK-7194: white-label copy must not invent Atlas operator voice. */
const WHY_DIRECT_ITEMS_TENANT = [
    {
        icon: WHY_DIRECT_ITEMS_ATLAS[0].icon,
        heading: "Verified stays",
        body: "Photos on this page match the rooms you'll walk into. Book with confidence.",
    },
    {
        icon: WHY_DIRECT_ITEMS_ATLAS[1].icon,
        heading: "You pay the host directly",
        body: "",
    },
] as const;

const Home = () => {
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
    /** TASK-8055: fee claim follows payment rail; branding still gates Atlas operator voice. */
    const payDirectBody = directBookingPriceClaim(tenant);
    const whyDirectItems = useMemo(() => {
        const base = hideAtlasBranding ? WHY_DIRECT_ITEMS_TENANT : WHY_DIRECT_ITEMS_ATLAS;
        return base.map((item) =>
            item.heading === "You pay the host directly" ? { ...item, body: payDirectBody } : item,
        );
    }, [hideAtlasBranding, payDirectBody]);
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
            <section className="relative font-roboto select-none">
                <div className="w-full h-fit relative ">
                    <Slider />
                </div>
                <WaveDivider tone="coral" className="px-[5%] md:px-[12%] -mt-1" />
                <AtlasNeighbourhoodRibbon />
                <div>
                    <HomePage_Locations />
                </div>

                {/* A note from your host — lavender callout panel (Theem mockup §host-note) */}
                <section
                    aria-labelledby="host-note-heading"
                    className="px-4 sm:px-6 lg:px-8 py-10 md:py-14"
                    style={{ background: 'var(--peach, var(--bg-secondary, #fde0c8))' }}
                >
                    <div
                        className="max-w-6xl mx-auto rounded-2xl px-6 py-7 md:px-10 md:py-9"
                        style={{
                            background: 'var(--lavender-soft, #efe8f8)',
                            borderLeft: '4px solid var(--lavender-mid, var(--lavender-deep, #d8c0e8))',
                        }}
                    >
                        <p
                            id="host-note-heading"
                            className="text-xs font-semibold uppercase tracking-[0.18em] mb-3"
                            style={{ color: 'var(--lavender-text, #6f5aa8)' }}
                        >
                            A note from your host
                        </p>
                        <blockquote
                            className="text-xl md:text-2xl leading-relaxed text-text-primary"
                            style={{ fontFamily: 'var(--font-family-display)' }}
                        >
                            {hideAtlasBranding
                                ? `"Welcome to ${schemaBrandName}. Arrive, settle in, and let us take care of the rest — reach out any time if you need us."`
                                : `"Every home on this page is one we clean, restock, and hand over ourselves. Arrive, settle in, and let us take care of the rest — we're just down the street if you need us."`}
                        </blockquote>
                        {/* TASK-4923 pattern — bound to the panel's own lavender text role, not
                            `--text-muted`. This panel paints `var(--lavender-soft, #f0eafd)`, but
                            `--lavender-soft` is defined ONLY in default.css, so all 5 other classic
                            presets fall through to that hardcoded lavender — a surface their own
                            `--text-muted` was never tuned against (each is tuned to its own
                            `--bg-section-alt`). All landed just under AA on it: sunriseCoral 4.43,
                            oceanLuxury 4.48, emeraldOasis 4.45, newYear 4.41, valentine/christmas
                            4.05. `--lavender-text` is the token that IS contrast-validated against
                            this surface (default.css documents 4.83:1 on #f0eafd) and is already
                            used by the eyebrow directly above. */}
                        <p className="mt-3 text-sm" style={{ color: 'var(--lavender-text, #6f5aa8)' }}>— The {schemaBrandName} host team</p>
                    </div>
                </section>

                <WaveDivider tone="lavender" className="px-[8%] md:px-[18%]" />
                <AtlasNeighbourhoodRibbon variant="closer" />

                {/* Why-direct 2-pillar strip — tighter, centred columns (layout fix from screen 2) */}
                <section
                    className="mt-0"
                    style={{ background: 'var(--bg-secondary, #fde0c8)' }}
                    aria-labelledby="why-direct-heading"
                >
                    <WaveDivider tone="coral" className="opacity-80" />
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-14">
                        <h2 id="why-direct-heading" className="sr-only">Why book direct</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                            {whyDirectItems.map((item, index) => (
                                <div key={item.heading} className="flex flex-col items-center text-center gap-3 max-w-xs mx-auto">
                                    {/* Bare alternating coral/lavender icons — trust strip per Theem mockups */}
                                    <span
                                        className="inline-flex items-center justify-center w-12 h-12"
                                        style={{ color: index % 2 === 1 ? 'var(--lavender-deep, #8e7cc3)' : 'var(--brand-accent, #d4724e)' }}
                                        aria-hidden="true"
                                    >
                                        {item.icon}
                                    </span>
                                    <h3
                                        className="text-xl md:text-2xl font-medium text-text-primary"
                                        style={{ fontFamily: 'var(--font-family-display)', letterSpacing: '-0.005em', lineHeight: '1.2' }}
                                    >
                                        {item.heading}
                                    </h3>
                                    <p className="text-sm text-text-muted leading-relaxed">{item.body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <WaveDivider tone="lavender" flip />
                </section>

                <Suspense fallback={null}>
                    <div className="">
                        <ServicesSection />
                    </div>
                    <WaveDivider tone="coral" className="px-[10%]" />
                    <div className="px-4 lg:px-20 py-10 md:py-12" style={{ background: 'var(--bg-primary, #fefcf9)' }}>
                        <FaqHighlights />
                    </div>
                    <WaveDivider tone="lavender" className="px-[10%]" />
                    <div className="">
                        <TestimonialsSection />
                    </div>
                    {enableFooterMiniCtaAboveFooter && (
                        <FooterCtaStrip />
                    )}
                </Suspense>
                <WaveDivider tone="cream" className="px-[6%]" />
            </section>
        </>
    );
};

export default Home;
