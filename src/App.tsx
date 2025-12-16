import { BrowserRouter as Router, Routes, Route, useLocation, matchPath } from "react-router-dom"
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
import Apartments from "./pages/Apartments"
import Amenities from "./pages/Amenities"
import LocationPage from "./pages/LocationPage"
import GalleryPage from "./pages/GalleryPage"
import OffersPage from "./pages/OffersPage"
import AboutPage from "./pages/AboutPage"
import BlogHome from "./pages/blog/BlogHome"
import BlogCategory from "./pages/blog/BlogCategory"
import BlogPostPage from "./pages/blog/BlogPostPage"
import ShortLinkRedirect from "./components/ShortLinkRedirect"

function AppWrapper() {
  const location = useLocation();

  const hideNavbarRoutes = ['/property_LocationDetails/:id'];

  const shouldHideNavbar = hideNavbarRoutes.some((pattern) =>
    Boolean(matchPath(pattern, location.pathname))
  );

  return (
    <>
      {!shouldHideNavbar && <Navbar />}
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/apartments" element={<Apartments />} />
        <Route path="/amenities" element={<Amenities />} />
        <Route path="/location" element={<LocationPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/blog" element={<BlogHome />} />
        <Route path="/blog/:category" element={<BlogCategory />} />
        <Route path="/blog/:category/:slug" element={<BlogPostPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/property_details/:id" element={<Homepage_PropertyDetails />} />
        <Route path="/property_LocationDetails/:id" element={<Homepage_LocationDetails />} />
        <Route path="/:shortCode" element={<ShortLinkRedirect />} />
        <Route path="/*" element={<PageNotFound />} />
      </Routes>
      <Footer />
    </>
  );
}

function App() {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}

export default App
