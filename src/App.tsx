import React, { Suspense, useEffect, useState } from "react"
import { BrowserRouter as Router, Routes, Route, useLocation, matchPath, Navigate, useParams } from "react-router-dom"
import './App.css'
import Navbar from "./components/commonComponents/navbar/Navbar"
import Footer from "./components/commonComponents/footer/Footer"
import ScrollToTop from "./ScrollTop"
import ErrorBoundary from "./components/ErrorBoundary"
import { ToastContainer } from "react-toastify"
import { BookingProvider } from "./contexts/BookingContext"
import { ListingPhotosProvider } from "./contexts/ListingPhotosContext"
import { CurrencyProvider } from "./contexts/CurrencyContext"
import { GuestAuthProvider, useGuestAuth } from "./contexts/GuestAuthContext"
import { usePushNotifications } from "./hooks/usePushNotifications"
import NativeShellBridge from "./native/NativeShellBridge"
import { trackEvent } from "./utils/analytics"
import { isAtlastaysMarketplaceSurface, isMarketplaceMode } from "./tenant/tenantResolver"
import { CITY_LANDING_SLUGS } from "./content/cities/cityLandingSlugs"
import InternalTenantRobotsMeta from "./components/InternalTenantRobotsMeta"

const Home = React.lazy(() => import("./pages/home/Home"))
const ContactUs = React.lazy(() => import("./pages/contactus/ContactUs"))
const Homepage_PropertyDetails = React.lazy(() => import("./components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails"))
const Homepage_LocationDetails = React.lazy(() => import("./components/homepage_components/homepage_locationsdetails/Homepage_LocationDetails"))
const Policies = React.lazy(() => import("./pages/Policies"))
const Terms = React.lazy(() => import("./pages/Terms"))
const PrivacyPage = React.lazy(() => import("./pages/PrivacyPage"))
const Amenities = React.lazy(() => import("./pages/Amenities"))
const LocationPage = React.lazy(() => import("./pages/LocationPage"))
const GalleryPage = React.lazy(() => import("./pages/GalleryPage"))
const OffersPage = React.lazy(() => import("./pages/OffersPage"))
const AboutPage = React.lazy(() => import("./pages/AboutPage"))
const FaqPage = React.lazy(() => import("./pages/FaqPage"))
const SitemapPage = React.lazy(() => import("./pages/SitemapPage"))
const BlogHome = React.lazy(() => import("./pages/blog/BlogHome"))
const BlogCategory = React.lazy(() => import("./pages/blog/BlogCategory"))
const BlogPostPage = React.lazy(() => import("./pages/blog/BlogPostPage"))
const SearchPage = React.lazy(() => import("./pages/SearchPage"))
const MarketplaceHomepage = React.lazy(() => import("./pages/MarketplaceHomepage"))
const ShortLinkRedirect = React.lazy(() => import("./components/ShortLinkRedirect"))
const HomeDetails = React.lazy(() => import("./pages/home/HomeDetails"))
const SupportWidget = React.lazy(() => import("./components/support/SupportWidget"))
const Reserve = React.lazy(() => import("./pages/Reserve"))
const BecomeHost = React.lazy(() => import("./pages/BecomeHost"))
const BookingConfirmationPage = React.lazy(() => import("./pages/BookingConfirmationPage"))
const SelfCheckIn = React.lazy(() => import("./pages/SelfCheckIn")) // TASK-1254
const ReviewSubmitPage = React.lazy(() => import("./pages/ReviewSubmitPage"))
const CommunicationPreferences = React.lazy(() => import("./pages/CommunicationPreferences"))
const ProfilePage = React.lazy(() => import("./pages/ProfilePage"))
const MyBookingsPage = React.lazy(() => import("./pages/MyBookingsPage"))
const FavoritesPage = React.lazy(() => import("./pages/FavoritesPage"))
const RecentlyViewedPage = React.lazy(() => import("./pages/RecentlyViewedPage"))
const PrivacyPolicyPage = React.lazy(() => import("./pages/PrivacyPolicyPage"))
const CookieConsentBanner = React.lazy(() => import("./components/CookieConsentBanner"))
const PageNotFound = React.lazy(() => import("./pages/pagenotfound/PageNotFound"))
const CityLandingPage = React.lazy(() => import("./pages/CityLandingPage"))
// TASK-2612: Two-step booking flow — guest details step after Reserve
const GuestDetailsPage = React.lazy(() => import("./pages/booking/GuestDetailsPage"))
// TASK-4017: Guest OTP login
const GuestLoginPage = React.lazy(() => import("./pages/GuestLoginPage"))

function LazyFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #f3f4f6', borderTopColor: '#ea580c', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading page...</p>
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

  const shouldHideNavbar = hideNavbarRoutes.some((pattern) =>
    Boolean(matchPath(pattern, location.pathname))
  );

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
      <ScrollToTop />
      <ErrorBoundary name="router">
        <main id="main-content" tabIndex={-1} style={{ paddingTop: 'var(--nav-height)' }}>
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
          {CITY_LANDING_SLUGS.map((citySlug) => (
            <Route
              key={citySlug}
              path={`/homestays-in-${citySlug}`}
              element={withBoundary(
                <Suspense fallback={<LazyFallback />}>
                  <CityLandingPage citySlug={citySlug} />
                </Suspense>,
                `city-landing-${citySlug}-route`,
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
          <Route path="/privacy" element={withBoundary(<Suspense fallback={<LazyFallback />}><PrivacyPolicyPage /></Suspense>, "privacy-route")} />
          <Route path="/privacy-policy" element={withBoundary(<Suspense fallback={<LazyFallback />}><PrivacyPage /></Suspense>, "privacy-policy-legacy-route")} />
          <Route path="/terms" element={withBoundary(<Suspense fallback={<LazyFallback />}><Terms /></Suspense>, "terms-route")} />
          <Route path="/terms-and-conditions" element={withBoundary(<Suspense fallback={<LazyFallback />}><Terms /></Suspense>, "terms-legacy-route")} />
          <Route path="/homes/:propertySlug/:unitSlug" element={withBoundary(<Suspense fallback={<PropertyDetailsLazyFallback />}><Homepage_PropertyDetails /></Suspense>, "property-details-home-route")} />
          <Route path="/homes/:roomNo" element={withBoundary(<Suspense fallback={<LazyFallback />}><HomeDetails /></Suspense>, "home-details-route")} />
          <Route path="/property_details/:id" element={withBoundary(<Suspense fallback={<PropertyDetailsLazyFallback />}><LegacyPropertyRedirect /></Suspense>, "property-details-legacy-route")} />
          <Route path="/properties/:id" element={withBoundary(<Suspense fallback={<PropertyDetailsLazyFallback />}><LegacyPropertyRedirect /></Suspense>, "property-details-modern-redirect-route")} />
          <Route path="/reserve" element={withBoundary(<Suspense fallback={<LazyFallback />}><Reserve /></Suspense>, "reserve-route")} />
          <Route path="/booking/:bookingId" element={withBoundary(<Suspense fallback={<LazyFallback />}><BookingConfirmationPage /></Suspense>, "booking-confirmation-route")} />
          <Route path="/check-in/:bookingRef" element={withBoundary(<Suspense fallback={<LazyFallback />}><SelfCheckIn /></Suspense>, "self-checkin-route")} />
          <Route path="/check-in" element={withBoundary(<Suspense fallback={<LazyFallback />}><SelfCheckIn /></Suspense>, "self-checkin-noparam-route")} />
          <Route path="/review/:bookingId" element={withBoundary(<Suspense fallback={<LazyFallback />}><ReviewSubmitPage /></Suspense>, "review-submit-route")} />
          <Route path="/communication-preferences" element={withBoundary(<Suspense fallback={<LazyFallback />}><CommunicationPreferences /></Suspense>, "communication-preferences-route")} />
          <Route path="/preferences/:guestToken" element={withBoundary(<Suspense fallback={<LazyFallback />}><CommunicationPreferences /></Suspense>, "communication-preferences-token-route")} />
          <Route path="/profile" element={withBoundary(<Suspense fallback={<LazyFallback />}><ProfilePage /></Suspense>, "profile-route")} />
          <Route path="/my-bookings" element={withBoundary(<Suspense fallback={<LazyFallback />}><MyBookingsPage /></Suspense>, "my-bookings-route")} />
          {/* TASK-4283: /bookings used to hit the catch-all "Link not found" — alias it to /my-bookings. */}
          <Route path="/bookings" element={withBoundary(<Navigate to="/my-bookings" replace />, "bookings-alias-route")} />
          <Route path="/login" element={withBoundary(<Suspense fallback={<LazyFallback />}><GuestLoginPage /></Suspense>, "guest-login-route")} />
          <Route path="/favorites" element={withBoundary(<Suspense fallback={<LazyFallback />}><FavoritesPage /></Suspense>, "favorites-route")} />
          <Route path="/saved" element={withBoundary(<Navigate to="/favorites" replace />, "saved-alias-route")} />
          <Route path="/recent" element={withBoundary(<Suspense fallback={<LazyFallback />}><RecentlyViewedPage /></Suspense>, "recent-route")} />
          <Route path="/become-a-host" element={withBoundary(<Suspense fallback={<LazyFallback />}><BecomeHost /></Suspense>, "become-host-route")} />
          <Route path="/property_LocationDetails/:id" element={withBoundary(<Suspense fallback={<LazyFallback />}><Homepage_LocationDetails /></Suspense>, "location-details-route")} />
          {/* TASK-2612: Guest details step — MUST be before /:shortCode catch-all */}
          <Route path="/book/:propertySlug/:unitSlug/details" element={withBoundary(<Suspense fallback={<LazyFallback />}><GuestDetailsPage /></Suspense>, "guest-details-route")} />
          {/* TASK-4308: human-readable sitemap page — MUST be before /:shortCode catch-all */}
          <Route path="/sitemap" element={withBoundary(<Suspense fallback={<LazyFallback />}><SitemapPage /></Suspense>, "sitemap-route")} />
          <Route path="/:shortCode" element={withBoundary(<Suspense fallback={<LazyFallback />}><ShortLinkRedirect /></Suspense>, "shortlink-route")} />
          <Route path="/*" element={withBoundary(<Suspense fallback={<LazyFallback />}><PageNotFound /></Suspense>, "fallback-route")} />
        </Routes>
        </Suspense>
        </main>
      </ErrorBoundary>
      <Suspense fallback={null}><SupportWidget /></Suspense>
      <Footer />
      <Suspense fallback={null}><CookieConsentBanner /></Suspense>
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
