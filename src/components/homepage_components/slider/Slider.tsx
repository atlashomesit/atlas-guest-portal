import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Scrollbar, A11y, Autoplay } from 'swiper/modules';
import '../../../App.css';
import './Slider.css'
import { resolveOptimizedAsset } from '../../../utils/resolveOptimizedAsset';
// import Homepage_form from '../homepage_form/Homepage_form';
import { Link } from 'react-router-dom';
import { navbarData } from '../../../data';
import { LOGO_URL } from '../../../config/branding';

const Slider = () => {
    const images = [
        { id: 5, src: 'https://atlashomestorage.blob.core.windows.net/listing-images/fallback.jpeg', alt: 'Atlas Homes Banner' },
    ];

    return (
        <section className="relative text-black w-full h-[100vh] md:h-[60vh] flex justify-center items-start">
            {/* Logo */}
            <div className='z-30 absolute top-10 left-1/2 -translate-x-1/2 md:top-32 md:left-40 flex items-center justify-center'>
                <Link to='/'>
                    <img
                        className='w-20 h-20 md:w-44 md:h-20 object-cover rounded-md'
                        src={LOGO_URL}
                        alt='Logo'
                    />
                </Link>
            </div>

            <div className="relative w-full h-full">
                {/* Background Image Slider */}
                <div className='absolute top-14 w-full h-full'>
                    <Swiper
                        modules={[Navigation, Pagination, Scrollbar, A11y, Autoplay]}
                        spaceBetween={0}
                        autoplay={{ delay: 5000, disableOnInteraction: false }}
                        loop={true}
                        className="h-full w-full"
                    >
                        {images.map((image) => (
                            <SwiperSlide key={image.id}>
                                <div className="w-full h-full">
                                    <img
                                        src={image.src}
                                        alt={image.alt}
                                        className="object-cover w-full h-full"
                                    />
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>

                {/* Overlay Content */}
                <div className="z-20 absolute top-14 left-0 w-full h-full hero-overlay bg-gradient-to-t from-black/60 via-black/30 to-transparent flex items-center justify-center md:justify-start px-6 md:px-20 pointer-events-none ">
                    <div className="h-fit flex flex-col items-center md:items-start gap-3 md:gap-5 tracking-wide capitalize text-center md:text-left ">
                        {/* Heading */}
                        <p className="text-2xl md:text-5xl font-semibold text-white drop-shadow-lg">
                            Atlas Homestays
                        </p>

                        {/* Subheading (Hidden on very small screens) */}
                        <p className="text-base md:text-xl font-normal text-[#fff] hidden sm:block drop-shadow-md">
                            Luxury homestays made affordable
                        </p>


                    </div>
                </div>

                {/* Form Section */}
                {/* <div className="md:z-50 z-20 absolute bottom-10 md:-bottom-24 left-1/2 transform -translate-x-1/2 w-[80%] pointer-events-auto">
                    <Homepage_form />
                </div> */}

            </div>
        </section>
    );
};

export default Slider;