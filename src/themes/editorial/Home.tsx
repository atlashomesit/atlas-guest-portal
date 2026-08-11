/**
 * TASK-4924 / ADR-0081 D8 — "editorial" layout theme's Home page ("editorial magazine").
 *
 * Founder-specified visual direction (ATLAS-DEVELOPER-TASKS.md TASK-4924): "text-forward
 * composition, serif display typography, story-driven section flow — homepage/listing pages
 * read more like a magazine feature (long-form copy blocks, pull-quote-style callouts,
 * narrative section ordering) than the card-grid composition of classic/heritage." The
 * founder explicitly called this "the most structurally distinct layout in the launch
 * lineup" — the composition below is genuinely different from every sibling layout: no hero
 * photo slider (`classic`), no full-bleed nocturnal hero (`noir`), no horizontal scroll-snap
 * gallery (`coastal`) — instead a text-led masthead hero with an inset (not full-bleed) photo,
 * a long-form narrative section with a pull-quote callout, and the listings presented as a
 * vertical, alternating "feature spread" story flow (`EditorialFeaturedStays`) rather than a
 * grid or carousel. The booking/payment entry point (the real, shared
 * `SearchAvailabilityWidget`) is mounted directly in the hero, unambiguous and above the fold,
 * regardless of how narrative the rest of the page reads — per this task's stop-and-ask.
 *
 * All data-fetching, SEO/JSON-LD, tenant-branding, and analytics logic below reuses the
 * CURRENT shared implementation verbatim (`@/hooks`, `@/tenant`, `@/utils`, `@/components`,
 * `@/contexts`) — nothing here forks booking/payment/listing-data logic (ADR-0081 D1; this
 * task's stop-and-ask).
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
import { SearchAvailabilityWidget } from '../../components/availability/SearchAvailabilityWidget';
import FaqHighlights from '../../components/faq/FaqHighlights';
import { getPublicSiteOrigin } from '../../config/siteOrigin';
import { buildHomepageJsonLd } from '../../pages/home/homepageJsonLd';
import EditorialPullQuote from './EditorialPullQuote';
import EditorialFeaturedStays from './EditorialFeaturedStays';

const EditorialHome = () => {
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

    // Inset masthead photo (not full-bleed — the founder's "text-forward composition" brief):
    // the same allowlisted, public-read listing photo `classic`'s `Slider` and `noir`'s
    // full-bleed hero already use, reused verbatim (ADR-0081 D1: never fork imagery/data
    // sourcing), hidden for white-label tenants pending a per-tenant heroImageUrl (RA-006,
    // same rule every other layout's hero follows).
    const showAtlasContent = !hideAtlasBranding;
    const heroImageUrl = showAtlasContent ? HERO_IMAGE_URL : '';
    const hasHeroPhoto = Boolean(heroImageUrl.trim());
    const heroPhotoAriaLabel = showAtlasContent
        ? `A warm, owner-run ${schemaBrandName} living room`
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
            <section className="editorial-home font-roboto select-none" data-testid="editorial-home">
                {/* Text-led masthead hero: large serif headline + narrative sub-copy lead the
                    composition, with a smaller INSET photo (not full-bleed) — the founder's
                    "text-forward composition" brief, genuinely different from classic's split
                    Slider hero and noir's full-bleed photo hero. */}
                <div className="editorial-hero" data-testid="editorial-hero">
                    <div className="editorial-hero-copy">
                        <span className="editorial-eyebrow">{schemaBrandName} &middot; A field note</span>
                        <h1 className="editorial-hero-h1">
                            The story of your next stay, <em>told before you arrive</em>
                        </h1>
                        <p className="editorial-hero-dek">
                            {showAtlasContent
                                ? 'Owner-run homes in this neighbourhood — read the space, the area, and what to expect, then book direct in the same breath.'
                                : `Direct from the owner — responsive support from ${schemaBrandName}.`}
                        </p>
                        <div id="search-form" data-testid="hero-widget" className="editorial-hero-widget">
                            <SearchAvailabilityWidget />
                        </div>
                    </div>
                    <div className="editorial-hero-media" data-testid="editorial-hero-media">
                        {hasHeroPhoto ? (
                            <img
                                src={heroImageUrl}
                                alt={heroPhotoAriaLabel}
                                className="editorial-hero-photo"
                                loading="eager"
                            />
                        ) : (
                            <div
                                className="editorial-hero-photo editorial-hero-photo-fallback"
                                style={{ backgroundImage: 'var(--gradient-hero)' }}
                                aria-hidden="true"
                            />
                        )}
                    </div>
                </div>

                {/* Long-form narrative section with a pull-quote callout — the story-driven
                    section flow the founder's brief calls for, ahead of the listings. */}
                <section className="editorial-narrative" aria-labelledby="editorial-narrative-heading">
                    <div className="editorial-section-inner editorial-narrative-inner">
                        <span className="editorial-eyebrow">
                            {showAtlasContent ? 'Notes from the neighbourhood' : 'Notes from your host'}
                        </span>
                        <h2 id="editorial-narrative-heading" className="editorial-h2">
                            {showAtlasContent
                                ? 'Why guests keep coming back to this neighbourhood'
                                : `Why guests keep coming back to ${schemaBrandName}`}
                        </h2>
                        <p className="editorial-narrative-p">
                            {showAtlasContent
                                ? "Every address on this page is one we own and operate ourselves — nothing staged, nothing borrowed, no third-party listing dressed up for a photograph. The rooms you see are the rooms you'll walk into. Price shown is what you pay: room rate, GST, and a 3% payment-processing fee — no hidden charges."
                                : `Book directly with ${schemaBrandName}. The total shown at checkout is what you pay — no surprise OTA markups.`}
                        </p>
                        <EditorialPullQuote
                            quote={
                              showAtlasContent
                                ? "Book direct — the host keeps more. Price shown is what you pay: room rate, GST, and a 3% payment-processing fee."
                                : `Book direct with ${schemaBrandName}. The total shown at checkout is what you pay.`
                            }
                            attribution={showAtlasContent ? `${schemaBrandName}, on transparent pricing` : undefined}
                        />
                        <p className="editorial-narrative-p">
                            A host who answers the phone. That&apos;s the whole pitch — the rest is in the rooms
                            themselves, below.
                        </p>
                    </div>
                </section>

                {/* Story-flow featured stays — the layout's largest structural divergence: a
                    vertical, alternating feature-spread flow, not a grid or carousel. */}
                <EditorialFeaturedStays />

                <div className="editorial-section">
                    <ServicesSection />
                </div>
                <div className="editorial-section editorial-section-inner px-4 lg:px-20 py-8">
                    <FaqHighlights />
                </div>
                <div className="editorial-section">
                    <TestimonialsSection />
                </div>
                {enableFooterMiniCtaAboveFooter && <FooterCtaStrip />}
            </section>
        </>
    );
};

export default EditorialHome;
