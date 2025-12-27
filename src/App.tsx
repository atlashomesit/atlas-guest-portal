import { ReactNode, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, useLocation, matchPath, Navigate } from "react-router-dom"
import './App.css'
import PageNotFound from "./pages/pagenotfound/PageNotFound"
import Home from "./pages/home/Home"
import Navbar from "./components/commonComponents/navbar/Navbar"
import Footer from "./components/commonComponents/footer/Footer"
import ContactUs from "./pages/contactus/ContactUs"
import Homepage_PropertyDetails from "./components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails"
import ScrollToTop from "./ScrollTop"
import Homepage_LocationDetails from "./components/homepage_components/homepage_locationsdetails/Homepage_LocationDetails"
import Policies from "./pages/Policies"
import Terms from "./pages/Terms"
import Amenities from "./pages/Amenities"
import LocationPage from "./pages/LocationPage"
import GalleryPage from "./pages/GalleryPage"
import OffersPage from "./pages/OffersPage"
import AboutPage from "./pages/AboutPage"
import FaqPage from "./pages/FaqPage"
import BlogHome from "./pages/blog/BlogHome"
import BlogCategory from "./pages/blog/BlogCategory"
import BlogPostPage from "./pages/blog/BlogPostPage"
import SearchPage from "./pages/SearchPage"
import ShortLinkRedirect from "./components/ShortLinkRedirect"
import SupportWidget from "./components/support/SupportWidget"
import ErrorBoundary from "./components/ErrorBoundary"
import { ToastContainer } from "react-toastify"
import { BookingProvider } from "./contexts/BookingContext"
import Reserve from "./pages/Reserve"
import { trackEvent } from "./utils/analytics"

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

  return (
    <>
      {!shouldHideNavbar && <Navbar />}
      <ScrollToTop />
      <ErrorBoundary name="router">
        <Routes>
          <Route path="/" element={withBoundary(<Home />, "home-route")} />
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
          <Route path="/terms" element={withBoundary(<Terms />, "terms-route")} />
          <Route path="/terms-and-conditions" element={withBoundary(<Terms />, "terms-legacy-route")} />
          <Route path="/homes/:propertySlug/:unitSlug" element={withBoundary(<Homepage_PropertyDetails />, "property-details-home-route")} />
          <Route path="/property_details/:id" element={withBoundary(<Homepage_PropertyDetails />, "property-details-route")} />
          <Route path="/properties/:id" element={withBoundary(<Homepage_PropertyDetails />, "property-details-modern-route")} />
          <Route path="/reserve" element={withBoundary(<Reserve />, "reserve-route")} />
          <Route path="/property_LocationDetails/:id" element={withBoundary(<Homepage_LocationDetails />, "location-details-route")} />
          <Route path="/:shortCode" element={withBoundary(<ShortLinkRedirect />, "shortlink-route")} />
          <Route path="/*" element={withBoundary(<PageNotFound />, "fallback-route")} />
        </Routes>
      </ErrorBoundary>
      <SupportWidget />
      <Footer />
      <ToastContainer position="top-right" newestOnTop pauseOnFocusLoss={false} />
    </>
  );
}

function App() {
  return (
    <BookingProvider>
      <Router>
        <AppWrapper />
      </Router>
    </BookingProvider>
  );
}

export default App
