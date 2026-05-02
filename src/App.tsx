import React, { Suspense, useEffect } from "react"
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
import { trackEvent } from "./utils/analytics"
import { isMarketplaceMode } from "./tenant/tenantResolver"

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
const ReviewSubmitPage = React.lazy(() => import("./pages/ReviewSubmitPage"))
const CommunicationPreferences = React.lazy(() => import("./pages/CommunicationPreferences"))
const ProfilePage = React.lazy(() => import("./pages/ProfilePage"))
const MyBookingsPage = React.lazy(() => import("./pages/MyBookingsPage"))
const FavoritesPage = React.lazy(() => import("./pages/FavoritesPage"))
const RecentlyViewedPage = React.lazy(() => import("./pages/RecentlyViewedPage"))
const PrivacyPolicyPage = React.lazy(() => import("./pages/PrivacyPolicyPage"))
const CookieConsentBanner = React.lazy(() => import("./components/CookieConsentBanner"))
const PageNotFound = React.lazy(() => import("./pages/pagenotfound/PageNotFound"))

function LazyFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}
    >
      <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#ea580c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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

function AppWrapper() {
  const location = useLocation();

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

    if (!id) {
      return <Navigate to="/" replace />;
    }

    const normalizedId = id.toLowerCase();
    const trailingNumericId = normalizedId.match(/(\d+)$/)?.[1];
    if (!trailingNumericId) {
      // TASK-1220: malformed legacy slugs (no numeric listing id) should still land on a
      // concrete not-found page instead of hanging behind the property-details resolver.
      return <Navigate to={`/homes/${normalizedId}`} replace />;
    }
    const idParts = normalizedId.split('-').filter(Boolean);
    const canonicalPropertySlug = idParts.length >= 2 ? idParts.slice(0, 2).join('-') : 'atlas-homes';

    return <Navigate to={`/homes/${canonicalPropertySlug}/${normalizedId}`} replace />;
  };

  return (
    <>
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>
      {!shouldHideNavbar && <Navbar />}
      <ScrollToTop />
      <ErrorBoundary name="router">
        <main id="main-content" tabIndex={-1}>
        <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route
            path="/"
            element={withBoundary(isMarketplaceMode() ? <MarketplaceHomepage /> : <Home />, isMarketplaceMode() ? "marketplace-home-route" : "home-route")}
          />
          <Route path="/contact" element={withBoundary(<ContactUs />, "contact-route")} />
          <Route path="/apartments" element={withBoundary(<Navigate to="/#our-homes" replace />, "apartments-redirect")} />
          <Route path="/amenities" element={withBoundary(<Amenities />, "amenities-route")} />
          <Route path="/location" element={withBoundary(<LocationPage />, "location-route")} />
          <Route path="/gallery" element={withBoundary(<GalleryPage />, "gallery-route")} />
          <Route path="/offers" element={withBoundary(<OffersPage />, "offers-route")} />
          <Route path="/about" element={withBoundary(<AboutPage />, "about-route")} />
          <Route path="/faq" element={withBoundary(<FaqPage />, "faq-route")} />
          <Route path="/search" element={withBoundary(<SearchPage />, "search-route")} />
          <Route path="/blog" element={withBoundary(<BlogHome />, "blog-home-route")} />
          <Route path="/blog/:category" element={withBoundary(<BlogCategory />, "blog-category-route")} />
          <Route path="/blog/:category/:slug" element={withBoundary(<BlogPostPage />, "blog-post-route")} />
          <Route path="/blog/:slug" element={withBoundary(<BlogPostPage />, "blog-legacy-route")} />
          <Route path="/policies" element={withBoundary(<Policies />, "policies-route")} />
          <Route path="/privacy" element={withBoundary(<PrivacyPolicyPage />, "privacy-route")} />
          <Route path="/privacy-policy" element={withBoundary(<PrivacyPage />, "privacy-policy-legacy-route")} />
          <Route path="/terms" element={withBoundary(<Terms />, "terms-route")} />
          <Route path="/terms-and-conditions" element={withBoundary(<Terms />, "terms-legacy-route")} />
          <Route path="/homes/:propertySlug/:unitSlug" element={withBoundary(<Suspense fallback={<PropertyDetailsLazyFallback />}><Homepage_PropertyDetails /></Suspense>, "property-details-home-route")} />
          <Route path="/homes/:roomNo" element={withBoundary(<HomeDetails />, "home-details-route")} />
          <Route path="/property_details/:id" element={withBoundary(<Suspense fallback={<PropertyDetailsLazyFallback />}><LegacyPropertyRedirect /></Suspense>, "property-details-legacy-route")} />
          <Route path="/properties/:id" element={withBoundary(<Suspense fallback={<PropertyDetailsLazyFallback />}><LegacyPropertyRedirect /></Suspense>, "property-details-modern-redirect-route")} />
          <Route path="/reserve" element={withBoundary(<Reserve />, "reserve-route")} />
          <Route path="/booking/:bookingId" element={withBoundary(<BookingConfirmationPage />, "booking-confirmation-route")} />
          <Route path="/review/:bookingId" element={withBoundary(<ReviewSubmitPage />, "review-submit-route")} />
          <Route path="/communication-preferences" element={withBoundary(<CommunicationPreferences />, "communication-preferences-route")} />
          <Route path="/preferences/:guestToken" element={withBoundary(<CommunicationPreferences />, "communication-preferences-token-route")} />
          <Route path="/profile" element={withBoundary(<ProfilePage />, "profile-route")} />
          <Route path="/my-bookings" element={withBoundary(<MyBookingsPage />, "my-bookings-route")} />
          <Route path="/favorites" element={withBoundary(<FavoritesPage />, "favorites-route")} />
          <Route path="/recent" element={withBoundary(<RecentlyViewedPage />, "recent-route")} />
          <Route path="/become-a-host" element={withBoundary(<BecomeHost />, "become-host-route")} />
          <Route path="/property_LocationDetails/:id" element={withBoundary(<Homepage_LocationDetails />, "location-details-route")} />
          <Route path="/:shortCode" element={withBoundary(<ShortLinkRedirect />, "shortlink-route")} />
          <Route path="/*" element={withBoundary(<PageNotFound />, "fallback-route")} />
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
    <CurrencyProvider>
      <BookingProvider>
        <ListingPhotosProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppWrapper />
          </Router>
        </ListingPhotosProvider>
      </BookingProvider>
    </CurrencyProvider>
  );
}

export default App
