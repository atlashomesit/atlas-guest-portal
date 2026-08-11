/**
 * TASK-4925 / ADR-0081 D8 — "photoFirst" layout theme's Home page ("minimal photo-first").
 *
 * Founder-specified visual direction (ATLAS-DEVELOPER-TASKS.md TASK-4925): near-zero chrome
 * (minimal nav/borders/decorative UI), huge full-bleed photography as the primary content, and
 * a sticky booking bar (persistent call-to-action while scrolling) rather than the default's
 * inline/hero booking widget placement. The composition below is genuinely different from
 * every other layout in the lineup: no eyebrow badge, no glass/bordered widget card in the
 * hero, no decorative dividers between sections — a single edge-to-edge hero photograph with
 * minimal type, a vertical stack of further full-bleed listing photographs
 * (`PhotoFirstListingsStack`), and the real `SearchAvailabilityWidget` pinned to the viewport
 * bottom via `StickyBookingBar` instead of living inline in the hero.
 *
 * All data-fetching, SEO/JSON-LD, tenant-branding, and analytics logic below reuses the
 * CURRENT shared implementation verbatim (`@/hooks`, `@/tenant`, `@/utils`, `@/components`,
 * `@/contexts`) — nothing here forks booking/payment/listing-data logic (ADR-0081 D1; this
 * task's stop-and-ask). The booking entry point is the real, shared `SearchAvailabilityWidget`
 * (the same component every other layout's hero/search page uses), rendered inside
 * `StickyBookingBar`, not a re-implementation.
 */
import './Home.css';
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
import FaqHighlights from '../../components/faq/FaqHighlights';
import { getPublicSiteOrigin } from '../../config/siteOrigin';
import { buildHomepageJsonLd } from '../../pages/home/homepageJsonLd';
import PhotoFirstListingsStack from './PhotoFirstListingsStack';
import StickyBookingBar from './StickyBookingBar';

const PhotoFirstHome = () => {
    const { pendingScrollTarget, setPendingScrollTarget } = useBooking();
    const location = useLocation();
    const { properties: propertyData } = useTenantListings();
    const tenant = getTenantContext();
    const overrides = getTenantOverrides(tenant?.slug);
    const hideAtlasBranding = shouldHideAtlasBranding(tenant, overrides);
    const schemaBrandName = getTenantBrandName();
    const schemaLogo = overrides.hideLogo ? undefined : sanitizeGuestImageUrl(overrides.logoUrl ?? tenant?.logoUrl) ?? LOGO_URL;
    const contactEmail = getContactEmail();
    const room101Cover = sanitizeGuestImageUrl(propertyData.find((property) => property.id === 101)?.property_img?.[0]);
    const primaryOgImage = room101Cover ?? (!overrides.hideLogo ? LOGO_URL : undefined);
    const listingAddress = propertyData.find((property) => property.property_location?.trim())?.property_location?.trim();

    // Full-bleed hero photo: the same allowlisted, public-read listing photo used by
    // `classic`'s `Slider` and `noir`'s hero — reused verbatim (ADR-0081 D1: never fork
    // imagery/data sourcing), hidden for white-label tenants pending a per-tenant
    // heroImageUrl (RA-006, same rule every other layout follows).
    const showAtlasContent = !hideAtlasBranding;
    const heroImageUrl = showAtlasContent ? HERO_IMAGE_URL : '';
    const hasHeroPhoto = Boolean(heroImageUrl.trim());
    const heroPhotoAriaLabel = showAtlasContent
        ? `A ${schemaBrandName} home, shown in full`
        : `Welcome to ${schemaBrandName}`;

    const faqHighlights = getFaqHighlights();
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
            <section className="photofirst-home font-roboto select-none" data-testid="photofirst-home">
                {/* Full-bleed hero — a single edge-to-edge photograph, no eyebrow badge, no
                    bordered/glass widget card: near-zero chrome, huge photography, minimal type.
                    The booking entry point deliberately does NOT live here — it is pinned to the
                    viewport bottom via StickyBookingBar instead (founder brief). */}
                <div className="photofirst-hero" data-testid="photofirst-hero">
                    {hasHeroPhoto ? (
                        <div
                            className="photofirst-hero-photo"
                            style={{ backgroundImage: `url("${heroImageUrl}")` }}
                            role="img"
                            aria-label={heroPhotoAriaLabel}
                        />
                    ) : (
                        <div
                            className="photofirst-hero-photo"
                            style={{ backgroundImage: 'var(--gradient-hero)' }}
                            aria-hidden="true"
                        />
                    )}
                    <div className="photofirst-hero-scrim" aria-hidden="true" data-testid="photofirst-hero-scrim" />
                    <div className="photofirst-hero-content">
                        <h1 className="photofirst-hero-h1">{schemaBrandName}</h1>
                        <p className="photofirst-hero-sub">
                            {showAtlasContent
                                ? 'Owner-run homes in this neighbourhood, shown exactly as they are — scroll to see every room, book direct any time.'
                                : `Direct from the owner. Scroll to see every room at ${schemaBrandName}.`}
                        </p>
                    </div>
                </div>

                {/* Huge full-bleed photography as the primary content — every listing is one
                    edge-to-edge photograph, not a grid card (near-zero chrome brief). */}
                <PhotoFirstListingsStack />

                <div className="photofirst-section">
                    <ServicesSection />
                </div>
                <div className="photofirst-section px-4 lg:px-20 py-8">
                    <FaqHighlights />
                </div>
                <div className="photofirst-section">
                    <TestimonialsSection />
                </div>
                {enableFooterMiniCtaAboveFooter && <FooterCtaStrip />}

                {/* Persistent call-to-action while scrolling (founder brief) — the real,
                    shared SearchAvailabilityWidget, pinned to the viewport bottom. */}
                <StickyBookingBar />
            </section>
        </>
    );
};

export default PhotoFirstHome;
