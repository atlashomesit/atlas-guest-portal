import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Scrollbar, A11y, Autoplay, EffectCards } from 'swiper/modules';
import { MdOutlineNavigateNext } from "react-icons/md";
import { GrFormPrevious } from "react-icons/gr";
import { FaQuoteLeft } from "react-icons/fa";
import Heading from '../../commonComponents/heading/Heading';
import { getTenantContext } from '../../../tenant/tenantContext';

interface Review {
    review: string,
    clientName: string,
    rating?: number
}

const initialsFromName = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
};

const Homepage_Testimonial = () => {
    // RA-006: substitute tenant brand into placeholder testimonial copy.
    // Brand-neutral fallback: don't leak "Atlas Homes" if tenant context hasn't resolved.
    const brandName = getTenantContext()?.name?.trim() || "Our Homestays";
    const sub = (s: string) => s.replace(/__BRAND__/g, brandName);
    const data: Review[] = [
        {
            review: sub("__BRAND__ truly felt like a home away from home. The rooms were spotless, and every detail was thoughtfully arranged. I can't wait to visit again!"),
            clientName: 'Priya Sharma',
            rating: 5
        },
        {
            review: sub("From the warm welcome to the luxurious amenities, everything at __BRAND__ exceeded my expectations. Highly recommended for a relaxing stay."),
            clientName: 'Rahul Mehta',
            rating: 5
        },
        {
            review: "The location is perfect and the staff went above and beyond to make my stay comfortable. I especially loved the cozy lounge area.",
            clientName: 'Anjali Verma',
            rating: 4
        },
        {
            review: sub("A delightful experience! The service was impeccable and the ambiance was so peaceful. __BRAND__ is now my go-to place in the city."),
            clientName: 'Sameer Kulkarni',
            rating: 5
        },
        {
            review: sub("Spacious rooms, friendly staff, and a truly welcoming atmosphere. My family and I had a wonderful time at __BRAND__."),
            clientName: 'Neha Gupta',
            rating: 5
        }
    ];

    const renderStars = (rating: number = 5) => {
        return (
            <div className="flex gap-1 mt-2">
                {[...Array(5)].map((_, i) => (
                    <svg
                        key={i}
                        className={`w-4 h-4 ${i < rating ? "text-accent-primary" : "text-border-subtle"}`}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                ))}
            </div>
        )
    };

    return (
        <div className="py-12 bg-bg-muted">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <span className="block text-center mb-12">
                    <Heading title="Hear What Our Happy Guests Are Saying" />
                </span>

                <div className="relative w-full">
                    <Swiper
                        modules={[Navigation, Pagination, Scrollbar, A11y, Autoplay, EffectCards]}
                        spaceBetween={24}
                        slidesPerView={1}
                        pagination={{
                            clickable: true,
                            bulletClass: 'swiper-pagination-bullet bg-accent-primary w-2 h-2 inline-block rounded-full mx-1 opacity-60 cursor-pointer transition-opacity',
                            bulletActiveClass: 'swiper-pagination-bullet-active opacity-100',
                        }}
                        navigation={{
                            nextEl: '.NextElement',
                            prevEl: '.PrevElement'
                        }}
                        autoplay={{
                            delay: 3500,
                            disableOnInteraction: false
                        }}
                        breakpoints={{
                            640: {
                                slidesPerView: 2,
                                spaceBetween: 20
                            },
                            1024: {
                                slidesPerView: 3,
                                spaceBetween: 24
                            }
                        }}
                        className="testimonial-swiper pb-12"
                    >
                        {data?.map((item, index) => (
                            <SwiperSlide key={index}>
                                <div className="h-auto min-h-64 bg-bg-surface border border-border-subtle shadow-level1 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-level2 hover:border-cta-primary">
                                    <div className="p-6 h-full flex flex-col">
                                        <div className="mb-4">
                                            <FaQuoteLeft className="text-accent-primary text-3xl opacity-50" />
                                        </div>
                                        <p className="text-text-muted flex-grow mb-4">{item.review}</p>
                                        <div className="mt-auto flex items-center gap-3">
                                            <div
                                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--cta-primary)_22%,var(--bg-muted))] text-sm font-bold text-[color:color-mix(in_srgb,var(--cta-primary)_90%,var(--text-primary))]"
                                                aria-hidden
                                            >
                                                {initialsFromName(item.clientName)}
                                            </div>
                                            <div className="min-w-0">
                                                {renderStars(item.rating)}
                                                <p className="font-medium text-text-primary mt-1">{item.clientName}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>

                    <div className="absolute top-1/2 left-0 right-0 z-20 flex justify-between items-center px-2 transform -translate-y-1/2">
                        <button className="PrevElement flex justify-center items-center bg-bg-surface shadow-level1 hover:bg-cta-primary hover:text-[var(--text-contrast)] transition-colors duration-300 cursor-pointer h-10 w-10 md:h-12 md:w-12 rounded-full text-text-primary border border-border-subtle">
                            <GrFormPrevious className="text-xl md:text-2xl" />
                        </button>
                        <button className="NextElement flex justify-center items-center bg-bg-surface shadow-level1 hover:bg-cta-primary hover:text-[var(--text-contrast)] transition-colors duration-300 cursor-pointer h-10 w-10 md:h-12 md:w-12 rounded-full text-text-primary border border-border-subtle">
                            <MdOutlineNavigateNext className="text-xl md:text-2xl" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Homepage_Testimonial;
