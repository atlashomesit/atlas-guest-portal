import Slider from "../../components/homepage_components/slider/Slider";
import HomePage_Locations from "../../components/homepage_components/homepage_locations/HomePage_Locations";
import { useEffect } from 'react';
import { propertyData, propertyImages } from '../../data';
import { trackEvent } from '../../utils/analytics';
import BannerSecondary from "../../components/home/BannerSecondary";
import ServicesSection from "../../components/home/ServicesSection";
import WhyChooseSection from "../../components/home/WhyChooseSection";
import TestimonialsSection from "../../components/home/TestimonialsSection";
import FooterCtaStrip from "../../components/home/FooterCtaStrip";
import {
    enableFooterMiniCtaAboveFooter,
} from "../../config/homepageUxFlags";
import { useBooking } from "../../contexts/BookingContext";
import { useLocation } from "react-router-dom";

const Home = () => {
    const { pendingScrollTarget, setPendingScrollTarget } = useBooking();
    const location = useLocation();

    useEffect(() => {
        console.log('Home component mounted');
        console.log('propertyData:', propertyData);
        console.log('propertyImages:', propertyImages);
        trackEvent('home_view', { surface: 'home', listings: propertyData.length });
    }, []);

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
        <section className="relative font-roboto select-none">
            <div className="w-full h-fit relative ">
                <Slider />
            </div>
            <div>
                {/* <Homepage_Properties /> */}
            </div>
            <div>
                <HomePage_Locations />
            </div>
            <BannerSecondary />

            {/* <div className=" px-4 lg:px-20 ">
                <Amenities />
            </div> */}
            {/* <div className=" px-4 lg:px-20 ">
                <CounterUp />
            </div> */}
            {/* <div className="">
                <Homepage_LetUsGuide />
            </div> */}
            <div className="">
                <ServicesSection />
            </div>
            <div className="">
                <WhyChooseSection />
            </div>
            <div className="">
                <TestimonialsSection />
            </div>
            {enableFooterMiniCtaAboveFooter && (
                <FooterCtaStrip />
            )}
        </section>
    );
};

export default Home;
