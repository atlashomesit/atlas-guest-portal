import { useLocation } from "react-router-dom"
import Heading from "../../commonComponents/heading/Heading"
import '../../../App.css'
import { FaBed, FaShower, FaSwimmingPool, FaCar } from "react-icons/fa";
import { RxOpenInNewWindow } from "react-icons/rx";
import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Scrollbar, A11y, Autoplay } from 'swiper/modules';
import PropertyModal from "../propertymodal/PropertyModal";
import { useState, type ComponentProps } from "react";
import Subheading from "../../commonComponents/subheading/Subheading";
import Homepage_form from "../hotelBooking_form/BookingCard";
import { filterGuestImageUrls } from "../../../utils/guestImageUrl";

type LocationProperty = {
    id?: number;
    property_name?: string;
    property_img?: string[];
    property_subtitle?: string;
    property_location?: string;
    property_description?: string;
    property_amenities?: { amenities_icon?: string }[];
    property_address?: { value?: string }[];
    additional_cost_note?: string;
};

const Homepage_LocationDetails = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [selectedProperty, setSelectedProperty] = useState<LocationProperty | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const locationViseData = location.state?.property?.properties;


    const renderIcon = (iconName: string) => {
        switch (iconName) {
            case 'bed':
                return <FaBed />;
            case 'shower':
                return <FaShower />;
            case 'pool':
                return <FaSwimmingPool />;
            case 'car':
                return <FaCar />;
            default:
                return null;
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedProperty(null);
    };

   const handleNavigate = (property_name: string) => {
    const slug = property_name
        .trim() // ✅ removes trailing space (501 issue)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // ✅ removes special chars like "-"
        .replace(/\s+/g, '-'); // ✅ fixes double spaces

    navigate(`/property_details/${slug}`);
};


    const handleModal = (property: LocationProperty) => () => {
        setSelectedProperty(property);
        setIsModalOpen(true);
    };

    // Add a check to handle cases where property data might not exist
    if (!Array.isArray(locationViseData) || locationViseData.length === 0) {
        return (
            <section className="select-none h-screen bg-bg-muted justify-center items-center flex flex-col gap-10 py-4 pt-14">
                <div>
                    <Subheading />
                </div>
                <div>
                    <Homepage_form />
                </div>
                <div className="mt-10 text-3xl font-bold text-center">
                    Exciting Properties Arriving Soon!
                </div>
            </section>
        );
    }

    return (
        <section>
            <section className="select-none h-fit bg-bg-muted flex flex-col justify-center items-center  gap-4 py-4 pt-14 md:pt-2">
                <div className="">
                    <Subheading />
                </div>
                <div>
                    <Homepage_form />
                </div>
            </section>
            <Heading title="Explore Our Hotels" />
            <section className="relative flex justify-center items-center px-4 lg:px-14 py-8 pb-10 md:pb-20">
                <div className=" flex flex-col gap-5  md:flex-row items-start">
                    {/* filters Left side  */}
                    <div className="flex-[1] md:sticky md:top-14 bg-bg-surface shadow-level1 rounded-md p-4 h-fit border border-border-subtle text-text-primary">
                        <h2 className="text-lg font-semibold mb-4 border-b border-border-subtle pb-2">Filter by:</h2>

                        {/* Price per night */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-text-primary mb-2">Price per night</h3>
                            <div className="flex flex-col gap-2 text-sm text-text-muted">
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" className="accent-accent-primary" />
                                    Under ₹1,500
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" className="accent-accent-primary" />
                                    ₹1,500 – ₹2,000
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" className="accent-accent-primary" />
                                    ₹2,000 – ₹2,500
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" className="accent-accent-primary" />
                                    ₹2,500 – ₹3,000
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" className="accent-accent-primary" />
                                    ₹3,000 & above
                                </label>
                            </div>
                        </div>

                        {/* Other filters */}
                        <div>
                            <h3 className="text-sm font-semibold text-text-primary mb-2">Other filters</h3>
                            <div className="flex flex-col gap-2 text-sm text-text-muted">
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" className="accent-accent-primary" />
                                    Couple friendly
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" className="accent-accent-primary" />
                                    Triple occupancy
                                </label>
                            </div>
                        </div>

                        {/* Icons */}
                        <div className="bg-cta-primary text-[var(--text-contrast)] text-center p-4 py-10 rounded-lg my-7 shadow-level1">
                            <div className="font-semibold text-sm">Excellent sleep & shower</div>
                            <div className="text-xs mb-3"></div>
                            <div className="grid grid-cols-4 gap-4 text-xs">
                                <div className="flex flex-col items-center">
                                    <span>📶</span>
                                    Free WiFi
                                </div>
                                <div className="flex flex-col items-center">
                                    <span>📺</span>
                                    TV
                                </div>
                                <div className="flex flex-col items-center">
                                    <span>❄️</span>
                                    AC
                                </div>
                                <div className="flex flex-col items-center">
                                    <span>🛡️</span>
                                    24×7 Security
                                </div>
                                <div className="flex flex-col items-center">
                                    <span>🧼</span>
                                    Clean towels
                                </div>
                                <div className="flex flex-col items-center">
                                    <span>💧</span>
                                    Hot water
                                </div>
                                <div className="flex flex-col items-center">
                                    <span>🧴</span>
                                    Toiletries
                                </div>
                                <div className="flex flex-col items-center">
                                    <span>🛎️</span>
                                    Room service
                                </div>
                            </div>
                        </div>

                        {/* Amenities checkboxes */}
                        <div className="p-4">
                            <h3 className="text-sm font-semibold text-text-primary mb-2">Amenities</h3>
                            <div className="flex flex-col gap-2 text-sm text-text-muted">
                                <label className="flex items-center gap-2 text-text-muted opacity-70">
                                    <input type="checkbox" disabled className="accent-accent-primary" />
                                    Swimming Pool
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" className="accent-accent-primary" />
                                    Lift
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" className="accent-accent-primary" />
                                    Gym
                                </label>
                                <label className="flex items-center gap-2 text-text-muted opacity-70">
                                    <input type="checkbox" disabled className="accent-accent-primary" />
                                    Study Table
                                </label>
                                <label className="flex items-center gap-2 text-text-muted opacity-70">
                                    <input type="checkbox" disabled className="accent-accent-primary" />
                                    Electric Kettle
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* our location wise properties = Right side  */}
                    <div className="flex-[3.5] w-full h-fit grid grid-cols-1 place-items-center gap-6">
                        {locationViseData.map((data: { id?: number; property_name?: string; property_img?: string[]; property_subtitle?: string; property_location?: string; property_description?: string; property_amenities?: Array<{ amenities_icon?: string; amenities_count?: number; amenities_availablity?: string; amenities_type?: string }>; property_address?: Array<{ value?: string }> }) => {
                            const imgs = filterGuestImageUrls(data?.property_img ?? []);
                            return (
                            <div
                                key={data.id}
                                className="group w-full flex flex-col md:flex-row gap-4 bg-bg-surface p-4 border border-border-subtle hover:border-cta-primary rounded-md shadow-level1 transition"
                            >
                                {/* Left: Image Slider */}
                                <div className="relative w-full md:w-2/5 h-60 rounded-md overflow-hidden">
                                    <Swiper
                                        modules={[Navigation, Pagination, Scrollbar, A11y, Autoplay]}
                                        spaceBetween={0}
                                        navigation
                                        loop={imgs.length > 1}
                                        className="h-full w-full"
                                    >
                                        {imgs.length > 0 ? (
                                            imgs.map((image: string, index: number) => (
                                            <SwiperSlide key={index}>
                                                <div
                                                    onClick={() => handleNavigate(String(data.property_name ?? ""))}
                                                    className="h-full w-full cursor-pointer"
                                                >
                                                    <img
                                                        src={image}
                                                        alt={`${data.property_name} - Image ${index + 1}`}
                                                        className="object-cover w-full h-full"
                                                    />
                                                </div>
                                            </SwiperSlide>
                                        ))
                                        ) : (
                                            <SwiperSlide key="placeholder">
                                                <div
                                                    className="h-full w-full min-h-[240px] bg-bg-muted bg-[linear-gradient(135deg,color-mix(in_srgb,var(--border-subtle)_55%,transparent)_0%,color-mix(in_srgb,var(--bg-muted)_92%,transparent)_100%)]"
                                                    role="img"
                                                    aria-label="No photos"
                                                />
                                            </SwiperSlide>
                                        )}
                                    </Swiper>

                                    {/* Overlay Elements */}
                                    <div className="absolute bottom-2 left-2 bg-[color:color-mix(in_srgb,var(--text-primary)_65%,transparent)] text-[var(--text-contrast)] text-xs px-2 py-1 rounded">
                                        📷 {imgs.length} photos
                                    </div>
                                    <span
                                        onClick={handleModal(data)}
                                        className="absolute right-2 top-2 cursor-pointer z-[var(--z-dropdown)] bg-[color:color-mix(in_srgb,var(--bg-surface)_60%,transparent)] hover:bg-bg-surface p-1 rounded-full"
                                    >
                                        <RxOpenInNewWindow size={18} />
                                    </span>
                                </div>

                                {/* Right: Textual Content */}
                                <div className="flex flex-col justify-between w-full md:w-3/5">
                                    <div className="flex flex-col gap-2 h-full">
                                        {/* Title + Subtitle */}
                                        <div>
                                            <h2 className="text-xl font-semibold text-text-primary">{data.property_name}</h2>
                                            {data.property_subtitle && (
                                                <p className="text-sm text-text-muted italic">{data.property_subtitle}</p>
                                            )}
                                        </div>

                                        {/* Location */}
                                        <div className="text-sm text-accent-primary">{data.property_location}</div>

                                        {/* Description */}
                                        {data.property_description && (
                                            <p className="text-xs text-text-muted line-clamp-3">{data.property_description}</p>
                                        )}

                                        {/* Amenities */}
                                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-text-muted">
                                            {data?.property_amenities?.slice(0, 4).map((amenity: { amenities_icon?: string; amenities_count?: number; amenities_availablity?: string; amenities_type?: string }, index: number) => (
                                                <div key={index} className="flex items-center gap-1">
                                                    <span>{renderIcon(amenity.amenities_icon)}</span>
                                                    <span>
                                                        {amenity.amenities_count || amenity.amenities_availablity || amenity.amenities_type}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Address Summary */}
                                        <div className="text-xs mt-2 text-text-muted opacity-75 flex flex-wrap gap-1">
                                            {data.property_address?.slice(0, 3).map((addr: { value?: string }, i: number) => (
                                                <span key={i}>
                                                    {addr.value}
                                                    {i !== 2 && ','}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Highlights */}
                                        <div className="flex flex-wrap gap-3 mt-3 text-green-600 text-xs">
                                            <span>✔ Free cancellation</span>
                                            <span>✔ Pay @ hotel</span>
                                            <span>✔ Couple friendly</span>
                                            {data.additional_cost_note && (
                                                <span className="text-red-400">⚠ {data.additional_cost_note}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                        })}
                    </div>

                </div>

                {/* Modal */}
                {isModalOpen && (
                    <PropertyModal
                        property={selectedProperty as ComponentProps<typeof PropertyModal>["property"]}
                        onClose={closeModal}
                        handleNavigate={(property) => handleNavigate(property.property_name)}
                    />
                )}
            </section>
        </section>
    )
}

export default Homepage_LocationDetails
