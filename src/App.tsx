import React, { Suspense, useEffect, useState } from "react"
import { BrowserRouter as Router, Routes, Route, useLocation, matchPath, Navigate, useParams } from "react-router-dom"
import './App.css'
import Navbar from "./components/commonComponents/navbar/Navbar"
import Footer from "./components/commonComponents/footer/Footer"
import ScrollToTop from "./ScrollTop"
import ErrorBoundary from "./components/ErrorBoundary"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { BookingProvider } from "./contexts/BookingContext"
import { ListingPhotosProvider } from "./contexts/ListingPhotosContext"
import { CurrencyProvider } from "./contexts/CurrencyContext"
import { GuestAuthProvider, useGuestAuth } from "./contexts/GuestAuthContext"
import { usePushNotifications } from "./hooks/usePushNotifications"
import NativeShellBridge from "./native/NativeShellBridge"
import { trackEvent } from "./utils/analytics"
import { isAtlastaysMarketplaceSurface, isMarketplaceMode } from "./tenant/tenantResolver"
import { getTenantContext } from "./tenant/tenantContext"
import { isTenantNotTakingBookings, NOT_TAKING_BOOKINGS_COPY } from "./tenant/paymentRail"
import { CITY_LANDING_SLUGS } from "./content/cities/cityLandingSlugs"
import InternalTenantRobotsMeta from "./components/InternalTenantRobotsMeta"
// TASK-4903 (ADR-0081): the theme mount point. Sole allowed import of `./themes/registry`
// outside `src/themes/` itself (ESLint boundary rule, eslint.config.js) — resolves which
// registered layout theme's Home/PropertyDetails/Gallery/About/Contact pages to render.
import { getCurrentLayoutThemeId, loadLayoutTheme } from "./themes/registry"

// TASK-4903: the five themed pages (home, listing detail, gallery, about, contact) are
// resolved from the boot-resolved layout theme's package instead of a fixed page-file path.
// `getCurrentLayoutThemeId()` is read lazily inside each loader — safe because React only
// invokes a `React.lazy()` loader on first render, well after `src/main.tsx`'s boot sequence
// has already called `setCurrentLayoutThemeId()`. Stubbed to "classic" until TASK-4904 lands
// `effectiveThemeId` server-side — today this resolves identically to the pre-4903 direct
// imports below (classic re-exports the same page components verbatim).
const Home = React.lazy(() => loadLayoutTheme(getCurrentLayoutThemeId()).then((mod) => ({ default: mod.Home })))
const ContactUs = React.lazy(() => loadLayoutTheme(getCurrentLayoutThemeId()).then((mod) => ({ default: mod.Contact })))
const Homepage_PropertyDetails = React.lazy(() => loadLayoutTheme(getCurrentLayoutThemeId()).then((mod) => ({ default: mod.PropertyDetails })))
const GalleryPage = React.lazy(() => loadLayoutTheme(getCurrentLayoutThemeId()).then((mod) => ({ default: mod.Gallery })))
const AboutPage = React.lazy(() => loadLayoutTheme(getCurrentLayoutThemeId()).then((mod) => ({ default: mod.About })))
const Homepage_LocationDetails = React.lazy(() => import("./components/homepage_components/homepage_locationsdetails/Homepage_LocationDetails"))
const Policies = React.lazy(() => import("./pages/Policies"))
const Terms = React.lazy(() => import("./pages/Terms"))
const PrivacyPage = React.lazy(() => import("./pages/PrivacyPage"))
const Amenities = React.lazy(() => import("./pages/Amenities"))
const LocationPage = React.lazy(() => import("./pages/LocationPage"))
const OffersPage = React.lazy(() => import("./pages/OffersPage"))
const FaqPage = React.lazy(() => import("./pages/FaqPage"))
const SitemapPage = React.lazy(() => import("./pages/SitemapPage"))
const BlogHome = React.lazy(() => import("./pages/blog/BlogHome"))
const BlogCategory = React.lazy(() => import("./pages/blog/BlogCategory"))
const BlogPostPage = React.lazy(() => import("./pages/blog/BlogPostPage"))
const SearchPage = React.lazy(() => import("./pages/SearchPage"))
const MarketplaceHomepage = React.lazy(() => import("./pages/MarketplaceHomepage"))
const ShortLinkRedirect = React.lazy(() => import("./components/ShortLinkRedirect"))
const LegacyHomeRoomRedirect = React.lazy(() => import("./pages/home/LegacyHomeRoomRedirect"))
const SupportWidget = React.lazy(() => import("./components/support/SupportWidget"))
const Reserve = React.lazy(() => import("./pages/Reserve"))
const BecomeHost = React.lazy(() => import("./pages/BecomeHost"))
const BookingConfirmationPage = React.lazy(() => import("./pages/BookingConfirmationPage"))
const SecurityDepositPage = React.lazy(() => import("./pages/SecurityDepositPage")) // TASK-10299239
const SelfCheckIn = React.lazy(() => import("./pages/SelfCheckIn")) // TASK-1254
const HouseRulesAcceptPage = React.lazy(() => import("./pages/HouseRulesAcceptPage")) // TASK-guest-automation-phase3
const PayLinkPage = React.lazy(() => import("./pages/PayLinkPage")) // PAY-016
const ReviewSubmitPage = React.lazy(() => import("./pages/ReviewSubmitPage"))
const CommunicationPreferences = React.lazy(() => import("./pages/CommunicationPreferences"))
const MyDataPage = React.lazy(() => import("./pages/MyDataPage"))
const ProfilePage = React.lazy(() => import("./pages/ProfilePage"))
const MyBookingsPage = React.lazy(() => import("./pages/MyBookingsPage"))
const FavoritesPage = React.lazy(() => import("./pages/FavoritesPage"))
const RecentlyViewedPage = React.lazy(() => import("./pages/RecentlyViewedPage"))
const CookieConsentBanner = React.lazy(() => import("./components/CookieConsentBanner"))
const PageNotFound = React.lazy(() => import("./pages/pagenotfound/PageNotFound"))
const AtlasOnlyCityLanding = React.lazy(() => import("./pages/AtlasOnlyCityLanding"))
const DestinationsPage = React.lazy(() => import("./pages/DestinationsPage"))
const CityVanityRedirect = React.lazy(() => import("./components/CityVanityRedirect"))
// TASK-2612: Two-step booking flow — guest details step after Reserve
const GuestDetailsPage = React.lazy(() => import("./pages/booking/GuestDetailsPage"))
// TASK-8093: Embeddable booking widget (iframe entry)
const EmbedPage = React.lazy(() => import("./pages/EmbedPage"))
// TASK-4017: Guest OTP login
const GuestLoginPage = React.lazy(() => import("./pages/GuestLoginPage"))
const QrMenuPage = React.lazy(() => import("./pages/QrMenuPage"))
// REV-046: the page a guest reaches by scanning the host's review QR code (`/rate/:tenantSlug/:code`).
const ReviewQrPage = React.lazy(() => import("./pages/ReviewQrPage"))

function LazyFallback() {
  // TASK-7822: 50vh left the site footer in the first desktop viewport. Home then
  // replaced this fallback and shoved `footer.pt-16` down the page — that single
  // shift is CLS 0.377 of the measured 0.385 (Lighthouse 13.4 desktop on
  // dev.atlashomestays.com, 2026-08-13). 100vh keeps the footer below the fold
  // until the route chunk paints.
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      data-testid="lazy-route-fallback"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #f5ebe0', borderTopColor: 'var(--cta-primary, #b8472f)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-muted, #6b5a55)', fontSize: '14px' }}>Loading page...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function PropertyDetailsLazyFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-xl px-4">
        <h1 className="text-2xl font-semibold text-text-primary mb-4">Home Not Found</h1>
        <div className="text-text-muted">
          Loading property details...
        </div>
      </div>
    </div>
  )
}

function GuestNativeHooks() {
  const { auth, isLoading } = useGuestAuth();
  usePushNotifications(auth.isAuthenticated, auth.token);
  return <NativeShellBridge authLoading={isLoading} />;
}

/** GUEST-043: `/guest/portal` and `/portal` redirect to `/my-bookings` when authenticated, or `/check-in` when unauthenticated. */
export function GuestPortalAliasRedirect() {
  const { auth, isLoading } = useGuestAuth();
  const location = useLocation();
  if (isLoading) return <LazyFallback />;
  const target = auth.isAuthenticated ? '/my-bookings' : '/check-in';
  return <Navigate to={`${target}${location.search}`} replace />;
}

/** GUEST-052: `/checkin` redirects to `/check-in` preserving query parameters (e.g. `?t=...`). */
export function CheckinAliasRedirect() {
  const location = useLocation();
  return <Navigate to={`/check-in${location.search}`} replace />;
}

/** GUEST-052: `/checkin/:bookingRef` redirects to `/check-in/:bookingRef` preserving query parameters (e.g. `?t=...`). */
export function CheckinBookingRefAliasRedirect() {
  const { bookingRef } = useParams<{ bookingRef: string }>();
  const location = useLocation();
  if (!bookingRef) {
    return <Navigate to={`/check-in${location.search}`} replace />;
  }
  return <Navigate to={`/check-in/${encodeURIComponent(bookingRef)}${location.search}`} replace />;
}

function AppWrapper() {
  const location = useLocation();
  const [, setLanguageVersion] = useState(0);

  // TASK-4018: Listen for language changes across the app
  useEffect(() => {
    const handleLanguageChange = () => {
      setLanguageVersion((v) => v + 1);
    };
    window.addEventListener('i18n-language-changed', handleLanguageChange);
    return () => {
      window.removeEventListener('i18n-language-changed', handleLanguageChange);
    };
  }, []);

  const hideNavbarRoutes = ['/property_LocationDetails/:id'];
  // TASK-8093: embed widget runs inside an iframe on a host's own site — no Atlas chrome.
  const isEmbedRoute = Boolean(matchPath('/embed/:embedKey', location.pathname));
  const isQrMenuRoute = Boolean(matchPath('/qr-menu/:tenantSlug', location.pathname));
  // REV-046: the review QR page is a standalone, one-screen page (no navbar, footer, support widget or cookie banner).
  const isReviewQrRoute = Boolean(matchPath('/rate/:tenantSlug/:code', location.pathname));

  const shouldHideNavbar = isEmbedRoute || isQrMenuRoute || isReviewQrRoute || hideNavbarRoutes.some((pattern) =>
    Boolean(matchPath(pattern, location.pathname))
  );
  const shouldHideFooter = isEmbedRoute || isQrMenuRoute || isReviewQrRoute;
  // Classic tenant home owns the inline consent region immediately after its search.
  // Other themes/routes keep the global consent banner; no tenant resolution changes.
  const inlineHomeConsent = location.pathname === '/' && getCurrentLayoutThemeId() === 'classic'
    && !(isMarketplaceMode() && isAtlastaysMarketplaceSurface());

  const withBoundary = (element: React.ReactNode, name: string) => (
    <ErrorBoundary key={`${name}-${location.pathname}`} name={name}>
      {element}
    </ErrorBoundary>
  );

  useEffect(() => {
    trackEvent('page_view', { surface: 'router' }, { route: location.pathname });
  }, [location.pathname]);

  const LegacyPropertyRedirect = () => {
    const { id } = useParams();
    const location = useLocation();

    if (!id) {
      return <Navigate to="/" replace />;
    }

    const normalizedId = id.toLowerCase();
    const trailingNumericId = normalizedId.match(/(\d+)$/)?.[1];
    if (!trailingNumericId) {
      // TASK-1220: malformed legacy slugs (no numeric listing id) should still land on a
      // concrete not-found page instead of hanging behind the property-details resolver.
      return <Navigate to={`/homes/${normalizedId}${location.search}`} replace />;
    }
    const idParts = normalizedId.split('-').filter(Boolean);
    const canonicalPropertySlug = idParts.length >= 2 ? idParts.slice(0, 2).join('-') : 'atlas-homes';

    return <Navigate to={`/homes/${canonicalPropertySlug}/${trailingNumericId}${location.search}`} replace />;
  };

  return (
    <>
      <InternalTenantRobotsMeta />
      <GuestNativeHooks />
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>
      {!shouldHideNavbar && <Navbar />}
      {isTenantNotTakingBookings(getTenantContext()) && (
        <div
          role="status"
          data-testid="tenant-not-taking-bookings-banner"
          style={{
            background: '#fef3c7',
            color: '#92400e',
            borderBottom: '1px solid #f59e0b',
            padding: '10px 16px',
            textAlign: 'center',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          {NOT_TAKING_BOOKINGS_COPY}
        </div>
      )}
      <ScrollToTop />
      <ErrorBoundary name="router">
        <main
          id="main-content"
          tabIndex={-1}
          style={{ paddingTop: shouldHideNavbar ? 0 : 'var(--measured-nav-height, var(--nav-height))' }}
        >
        <Suspense fallback={<LazyFallback />} key={`suspense-${location.pathname}`}>
        <Routes key={location.pathname}>
          <Route
            path="/"
            element={withBoundary(<Suspense fallback={<LazyFallback />}>{isMarketplaceMode() && isAtlastaysMarketplaceSurface() ? <MarketplaceHomepage /> : <Home />}</Suspense>, isMarketplaceMode() && isAtlastaysMarketplaceSurface() ? "marketplace-home-route" : "home-route")}
          />
          <Route path="/contact" element={withBoundary(<Suspense fallback={<LazyFallback />}><ContactUs /></Suspense>, "contact-route")} />
          <Route path="/apartments" element={withBoundary(<Navigate to="/#our-homes" replace />, "apartments-redirect")} />
          <Route path="/amenities" element={withBoundary(<Suspense fallback={<LazyFallback />}><Amenities /></Suspense>, "amenities-route")} />
          <Route path="/location" element={withBoundary(<Suspense fallback={<LazyFallback />}><LocationPage /></Suspense>, "location-route")} />
          <Route path="/gallery" element={withBoundary(<Suspense fallback={<LazyFallback />}><GalleryPage /></Suspense>, "gallery-route")} />
          <Route path="/offers" element={withBoundary(<Suspense fallback={<LazyFallback />}><OffersPage /></Suspense>, "offers-route")} />
          <Route path="/about" element={withBoundary(<Suspense fallback={<LazyFallback />}><AboutPage /></Suspense>, "about-route")} />
          <Route path="/faq" element={withBoundary(<Suspense fallback={<LazyFallback />}><FaqPage /></Suspense>, "faq-route")} />
          {/* TASK-7194: city SEO landings are Atlas-only (AtlasOnlyCityLanding gates white-label). */}
          {CITY_LANDING_SLUGS.map((citySlug) => (
            <Route
              key={citySlug}
              path={`/homestays-in-${citySlug}`}
              element={withBoundary(
                <Suspense fallback={<LazyFallback />}>
                  <AtlasOnlyCityLanding citySlug={citySlug} />
                </Suspense>,
                `city-landing-${citySlug}-route`,
              )}
            />
          ))}
          {/* MKT-034: city directory hub. /explore is an alias of /destinations. Both MUST stay before /:shortCode. */}
          <Route path="/destinations" element={withBoundary(<Suspense fallback={<LazyFallback />}><DestinationsPage /></Suspense>, "destinations-route")} />
          <Route path="/explore" element={withBoundary(<Suspense fallback={<LazyFallback />}><DestinationsPage /></Suspense>, "explore-route")} />
          {/* MKT-034: naked city slugs (/coorg) redirect to /homestays-in-coorg on the marketplace surface. MUST stay before /:shortCode.
              No static short link (shortLinkMap) shares a slug with a city (pinned in cityVanityRoutes.test.tsx). */}
          {CITY_LANDING_SLUGS.map((citySlug) => (
            <Route
              key={`vanity-${citySlug}`}
              path={`/${citySlug}`}
              element={withBoundary(
                <Suspense fallback={<LazyFallback />}>
                  <CityVanityRedirect citySlug={citySlug} />
                </Suspense>,
                `city-vanity-${citySlug}-route`,
              )}
            />
          ))}
          <Route path="/search" element={withBoundary(<Suspense fallback={<LazyFallback />}><SearchPage /></Suspense>, "search-route")} />
          <Route path="/blog" element={withBoundary(<Suspense fallback={<LazyFallback />}><BlogHome /></Suspense>, "blog-home-route")} />
          {/* TASK-4307: single-segment /blog/:segment is handled by BlogCategory, which
              renders the article when the segment is a post slug (canonical /blog/<slug>)
              and the category listing otherwise. The old shadowed /blog/:slug route is gone. */}
          <Route path="/blog/:category" element={withBoundary(<Suspense fallback={<LazyFallback />}><BlogCategory /></Suspense>, "blog-category-route")} />
          <Route path="/blog/:category/:slug" element={withBoundary(<Suspense fallback={<LazyFallback />}><BlogPostPage /></Suspense>, "blog-post-route")} />
          <Route path="/policies" element={withBoundary(<Suspense fallback={<LazyFallback />}><Policies /></Suspense>, "policies-route")} />
          <Route path="/privacy" element={withBoundary(<Suspense fallback={<LazyFallback />}><PrivacyPage /></Suspense>, "privacy-route")} />
          <Route path="/privacy-policy" element={withBoundary(<Navigate to="/privacy" replace />, "privacy-policy-redirect-route")} />
          <Route path="/terms" element={withBoundary(<Suspense fallback={<LazyFallback />}><Terms /></Suspense>, "terms-route")} />
          <Route path="/terms-and-conditions" element={withBoundary(<Suspense fallback={<LazyFallback />}><Terms /></Suspense>, "terms-legacy-route")} />
          <Route path="/homes/:propertySlug/:unitSlug" element={withBoundary(<Suspense fallback={<PropertyDetailsLazyFallback />}><Homepage_PropertyDetails /></Suspense>, "property-details-home-route")} />
          <Route path="/homes/:roomNo" element={withBoundary(<Suspense fallback={<LazyFallback />}><LegacyHomeRoomRedirect /></Suspense>, "home-details-route")} />
          <Route path="/property_details/:id" element={withBoundary(<Suspense fallback={<PropertyDetailsLazyFallback />}><LegacyPropertyRedirect /></Suspense>, "property-details-legacy-route")} />
          <Route path="/properties/:id" element={withBoundary(<Suspense fallback={<PropertyDetailsLazyFallback />}><LegacyPropertyRedirect /></Suspense>, "property-details-modern-redirect-route")} />
          <Route path="/reserve" element={withBoundary(<Suspense fallback={<LazyFallback />}><Reserve /></Suspense>, "reserve-route")} />
          <Route path="/booking/:bookingId" element={withBoundary(<Suspense fallback={<LazyFallback />}><BookingConfirmationPage /></Suspense>, "booking-confirmation-route")} />
          {/* TASK-10299239: security-deposit hold page, reached from the pre-arrival message; authorised by the same booking-link token (?t=). */}
          <Route path="/booking/:bookingId/deposit" element={withBoundary(<Suspense fallback={<LazyFallback />}><SecurityDepositPage /></Suspense>, "security-deposit-route")} />
          <Route path="/check-in/:bookingRef" element={withBoundary(<Suspense fallback={<LazyFallback />}><SelfCheckIn /></Suspense>, "self-checkin-route")} />
          <Route path="/check-in" element={withBoundary(<Suspense fallback={<LazyFallback />}><SelfCheckIn /></Suspense>, "self-checkin-noparam-route")} />
          {/* GUEST-052: Unhyphenated /checkin aliases preserving query params (?t=...) */}
          <Route path="/checkin/:bookingRef" element={withBoundary(<CheckinBookingRefAliasRedirect />, "self-checkin-alias-ref-route")} />
          <Route path="/checkin" element={withBoundary(<CheckinAliasRedirect />, "self-checkin-alias-route")} />
          {/* GUEST-043: /guest/portal and /portal aliases routing to /my-bookings (authenticated) or /check-in (unauthenticated) */}
          <Route path="/guest/portal" element={withBoundary(<GuestPortalAliasRedirect />, "guest-portal-alias-route")} />
          <Route path="/portal" element={withBoundary(<GuestPortalAliasRedirect />, "portal-alias-route")} />
          <Route path="/pay/:token" element={withBoundary(<Suspense fallback={<LazyFallback />}><PayLinkPage /></Suspense>, "pay-link-route")} />
          <Route path="/house-rules/:bookingRef" element={withBoundary(<Suspense fallback={<LazyFallback />}><HouseRulesAcceptPage /></Suspense>, "house-rules-accept-route")} />
          <Route path="/review/:bookingId" element={withBoundary(<Suspense fallback={<LazyFallback />}><ReviewSubmitPage /></Suspense>, "review-submit-route")} />
          <Route path="/communication-preferences" element={withBoundary(<Suspense fallback={<LazyFallback />}><CommunicationPreferences /></Suspense>, "communication-preferences-route")} />
          <Route path="/preferences/:guestToken" element={withBoundary(<Suspense fallback={<LazyFallback />}><CommunicationPreferences /></Suspense>, "communication-preferences-token-route")} />
          <Route path="/my-data/:guestToken" element={withBoundary(<Suspense fallback={<LazyFallback />}><MyDataPage /></Suspense>, "my-data-route")} />
          <Route path="/profile" element={withBoundary(<Suspense fallback={<LazyFallback />}><ProfilePage /></Suspense>, "profile-route")} />
          <Route path="/my-bookings" element={withBoundary(<Suspense fallback={<LazyFallback />}><MyBookingsPage /></Suspense>, "my-bookings-route")} />
          {/* TASK-4283: /bookings used to hit the catch-all "Link not found" — alias it to /my-bookings. */}
          <Route path="/bookings" element={withBoundary(<Navigate to="/my-bookings" replace />, "bookings-alias-route")} />
          {/* TASK-8093: embeddable widget iframe — must be before /:shortCode catch-all, no navbar/footer */}
          <Route path="/embed/:embedKey" element={withBoundary(<Suspense fallback={<LazyFallback />}><EmbedPage /></Suspense>, "embed-widget-route")} />
          <Route path="/login" element={withBoundary(<Suspense fallback={<LazyFallback />}><GuestLoginPage /></Suspense>, "guest-login-route")} />
          <Route path="/favorites" element={withBoundary(<Suspense fallback={<LazyFallback />}><FavoritesPage /></Suspense>, "favorites-route")} />
          <Route path="/saved" element={withBoundary(<Navigate to="/favorites" replace />, "saved-alias-route")} />
          <Route path="/recent" element={withBoundary(<Suspense fallback={<LazyFallback />}><RecentlyViewedPage /></Suspense>, "recent-route")} />
          <Route path="/become-a-host" element={withBoundary(<Suspense fallback={<LazyFallback />}><BecomeHost /></Suspense>, "become-host-route")} />
          <Route path="/property_LocationDetails/:id" element={withBoundary(<Suspense fallback={<LazyFallback />}><Homepage_LocationDetails /></Suspense>, "location-details-route")} />
          {/* TASK-2612: Guest details step — MUST be before /:shortCode catch-all */}
          <Route path="/book/:propertySlug/:unitSlug/details" element={withBoundary(<Suspense fallback={<LazyFallback />}><GuestDetailsPage /></Suspense>, "guest-details-route")} />
          {/* TASK-10298855: Guest Room & Table QR Self-Ordering Web App */}
          <Route path="/qr-menu/:tenantSlug" element={withBoundary(<Suspense fallback={<LazyFallback />}><QrMenuPage /></Suspense>, "qr-menu-route")} />
          {/* REV-046: review QR page — MUST be before the /:shortCode catch-all, no navbar/footer */}
          <Route path="/rate/:tenantSlug/:code" element={withBoundary(<Suspense fallback={<LazyFallback />}><ReviewQrPage /></Suspense>, "review-qr-route")} />
          {/* TASK-4308: human-readable sitemap page — MUST be before /:shortCode catch-all */}
          <Route path="/sitemap" element={withBoundary(<Suspense fallback={<LazyFallback />}><SitemapPage /></Suspense>, "sitemap-route")} />
          <Route path="/:shortCode" element={withBoundary(<Suspense fallback={<LazyFallback />}><ShortLinkRedirect /></Suspense>, "shortlink-route")} />
          <Route path="/*" element={withBoundary(<Suspense fallback={<LazyFallback />}><PageNotFound /></Suspense>, "fallback-route")} />
        </Routes>
        </Suspense>
        </main>
      </ErrorBoundary>
      {!shouldHideFooter && <div className={inlineHomeConsent ? "home-inline-support" : undefined}><Suspense fallback={null}><SupportWidget /></Suspense></div>}
      {!shouldHideFooter && <Footer />}
      {!shouldHideFooter && !inlineHomeConsent && <Suspense fallback={null}><CookieConsentBanner /></Suspense>}
      <ToastContainer position="top-right" newestOnTop pauseOnFocusLoss={false} />
    </>
  );
}

function App() {
  return (
    <GuestAuthProvider>
      <CurrencyProvider>
        <BookingProvider>
          <ListingPhotosProvider>
            <Router>
              <AppWrapper />
            </Router>
          </ListingPhotosProvider>
        </BookingProvider>
      </CurrencyProvider>
    </GuestAuthProvider>
  );
}

export default App
