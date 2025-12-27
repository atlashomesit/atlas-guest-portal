import { useLocation } from 'react-router-dom';
import { FaBed, FaShower, FaSwimmingPool, FaCar, FaWifi, FaTv } from "react-icons/fa";
import { TbAirConditioning } from "react-icons/tb";
import { PiElevatorDuotone, PiSecurityCameraDuotone } from "react-icons/pi";
import { RiLuggageCartLine } from "react-icons/ri";
import { TfiBrushAlt } from "react-icons/tfi";
import { LiaNewspaper } from "react-icons/lia";
import { MdOutlineEmojiFoodBeverage, MdOutlineLocalLaundryService, MdOutlineDone } from "react-icons/md";
import { FaCcMastercard, FaLocationDot } from "react-icons/fa6";
import { FaStar } from "react-icons/fa";
import { X, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { propertyData, propertyImages } from '../../../data.ts';
import { getUnitPolicy } from '../../../config/policyConfig';
import { inlinePolicySnippets } from '../../../content/terms';
import Subheading from '../../commonComponents/subheading/Subheading';
import HotelBooking_Form from '../hotelBooking_form/BookingCard.tsx';
import { trackEvent } from '../../../utils/analytics';
import { Button } from '../../ui/Button';
import { calculateNightlyPrice, inferUnitType } from '../../../utils/pricing';
import { useBooking } from '../../../contexts/BookingContext';

import { Fancybox } from "@fancyapps/ui";
import "@fancyapps/ui/dist/fancybox/fancybox.css";


interface PropertyAmenity {
    amenities_icon: string;
}

interface PropertyDetail {
    type: string;
    value: string;
}

interface Property {
    id: number;
    property_name: string;
    property_img: string[];
    property_location: string;
    property_amenities: PropertyAmenity[];
    property_description: string;
    property_nearplaces: string[];
    property_mapSrc: string;
    property_policy_details: PropertyDetail[];
    property_rating: number;
    property_reviews: number;
    property_review_snippets: string[];
    property_price: number;
}

const PropertyDetails = () => {
    const location = useLocation();
    const slug = location.pathname.split('/')[2];
    const [data, setData] = useState<Property | null>(null);
    const [showAmenitiesModal, setShowAmenitiesModal] = useState(false);
    const [showAboutMore, setShowAboutMore] = useState(false);
    const [showNeighborhoodMore, setShowNeighborhoodMore] = useState(false);
    const unitType = inferUnitType({ id: data?.id, property_name: data?.property_name });
    const { setProperty } = useBooking();
    const nightlyPrice = useMemo(() => {
        if (!data) return null;
        try {
            return calculateNightlyPrice({
                unitType,
                checkInDate: new Date(),
                guests: 2,
            });
        } catch (error) {
            console.warn("Unable to calculate nightly price for property", data.id, error);
            return null;
        }
    }, [data, unitType]);

    useEffect(() => {
        // First try to find by slug match
        const foundBySlug = propertyData.find((item: any) => {
            const propertySlug = item.property_name.toLowerCase().replace(/\s+/g, '-');
            return propertySlug === slug;
        });

        if (foundBySlug) {
            const images = propertyImages[String(foundBySlug.id)] || [];
            setData({
                ...foundBySlug,
                property_img: Array.isArray(images) ? images : []
            });
            return;
        }

        // If not found by slug, try to find by ID
        const propertyId = slug.split('-').pop();
        if (propertyId) {
            const foundById = propertyData.find((item: any) => String(item.id) === String(propertyId));
            if (foundById) {
                const images = propertyImages[String(foundById.id)] || [];
                setData({
                    ...foundById,
                    property_img: Array.isArray(images) ? images : []
                });
                return;
            }
        }

        // If still not found, try to get from location state
        if (location.state?.property) {
            const prop = location.state.property;
            const images = propertyImages[String(prop.id)] || [];
            setData({
                ...prop,
                property_img: Array.isArray(images) ? images : []
            });
            return;
        }

        console.error('No property found for slug:', slug);
    }, [slug, location.state]);

    useEffect(() => {
        if (!data?.id) return;
        setProperty(data.id);
        return () => setProperty(null);
    }, [data?.id, setProperty]);

    useEffect(() => {
        if (!data) return;

        // Fancybox v6 syntax
        (Fancybox as any).bind("[data-fancybox='property-gallery']", {
            Thumbs: {
                type: "classic",
            },
            Carousel: {
                transition: "slide",
            },
        });

        return () => {
            Fancybox.destroy();
        };
    }, [data]);

    useEffect(() => {
        if (!data) return;

        trackEvent(
            'listing_view',
            {
                surface: 'property_details',
                propertyName: data.property_name,
                price: nightlyPrice?.finalNightlyPrice ?? data.property_price,
            },
            { listingId: data.id, unitCode: data.id, route: location.pathname },
        );
    }, [data, location.pathname, nightlyPrice?.finalNightlyPrice]);

    const renderIcon = (iconName: string) => {
        const name = iconName.toLowerCase();
        if (name.includes('bed')) return <FaBed />;
        if (name.includes('shower') || name.includes('dryer')) return <FaShower />;
        if (name.includes('pool')) return <FaSwimmingPool />;
        if (name.includes('car') || name.includes('parking')) return <FaCar />;
        if (name.includes('wifi')) return <FaWifi />;
        if (name.includes('ac')) return <TbAirConditioning />;
        if (name.includes('lift') || name.includes('elevator')) return <PiElevatorDuotone />;
        if (name.includes('security')) return <PiSecurityCameraDuotone />;
        if (name.includes('tv')) return <FaTv />;
        if (name.includes('luggage')) return <RiLuggageCartLine />;
        if (name.includes('cleaning') || name.includes('housekeeping')) return <TfiBrushAlt />;
        if (name.includes('newspaper')) return <LiaNewspaper />;
        if (name.includes('breakfast') || name.includes('food')) return <MdOutlineEmojiFoodBeverage />;
        if (name.includes('card') || name.includes('payment')) return <FaCcMastercard />;
        if (name.includes('laundry')) return <MdOutlineLocalLaundryService />;
        return <MdOutlineDone />;
    };

    const formatAmenityName = (name: string) => {
        return name.charAt(0).toUpperCase() + name.slice(1);
    };

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-2xl font-semibold text-text-primary mb-4">Loading property details...</div>
                    <div className="text-text-muted">If this takes too long, the property may not exist or there might be a connection issue.</div>
                    <Button 
                        onClick={() => window.history.back()}
                        className="mt-4"
                    >
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }
    if (!data) return <p className='mt-40 mb-20 text-center text-3xl'>Loading...</p>;

    const unitPolicy = getUnitPolicy(data?.id);

    return (
        <section className="w-full pt-28 md:pt-0 tracking-wide">
            <div className='pt-10 pl-32'>
                <Subheading />
            </div>

            <div className="max-w-[85rem] flex flex-col gap-10 mx-auto px-4 sm:px-8 lg:px-16 py-8">
                {/* Property Header */}
                <div className="">
                    <h1 className="text-2xl sm:text-3xl font-semibold mb-2 capitalize text-text-primary">{data.property_name}</h1>
                    <div className="flex items-center text-text-muted">
                        <FaLocationDot className="mr-2 text-sm" />
                        <span className="text-sm sm:text-base">{data.property_location}</span>
                    </div>
                    <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3 text-sm text-text-muted">
                        <div className="flex items-center gap-2 font-semibold text-text-primary">
                            <FaStar className="text-accent-primary" />
                            <span>{data.property_rating.toFixed(2)}</span>
                            <span className="text-text-muted">• {data.property_reviews} reviews</span>
                        </div>
                        {data.property_review_snippets?.[0] && (
                            <p className="sm:pl-3 sm:border-l sm:border-border-subtle sm:ml-3 text-text-muted italic">
                                “{data.property_review_snippets[0]}”
                            </p>
                        )}
                    </div>
                </div>

                {/* Image Gallery */}
              {/* Image Gallery */}
<div className="flex gap-2 h-64 md:h-96 lg:h-[450px] overflow-hidden ">
  {/* Main image */}
      <div className="flex-1 relative h-full">
        <a href={propertyImages[data.id]?.[0] || data.property_img[0]} data-fancybox="property-gallery">
          <img
            src={propertyImages[String(data.id)]?.[0] || data.property_img[0]}
            alt="Main property"
            loading="lazy"
            decoding="async"
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="w-full h-full object-cover rounded-md"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = data.property_img[0] || '';
        }}
      />
    </a>
  </div>

  {/* Thumbnails */}
  <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 h-full">
    {(propertyImages[data.id]?.slice(1, 5) || data.property_img.slice(1, 5)).map((img: string, index: number) => (
      <div key={index} className="relative w-full h-full">
        <a href={img} data-fancybox="property-gallery">
          <img
            src={img}
            alt={`Thumbnail ${index + 1}`}
            loading="lazy"
            decoding="async"
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="w-full h-full object-cover rounded-md hover:opacity-80 transition"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = data.property_img[index + 1] || '';
            }}
          />
        </a>

        {/* Show "View photos" button only on the 4th thumbnail */}
        {index === 3 && (
          <button
            onClick={() => {
              const images = propertyImages[String(data.id)] || data.property_img;
              Fancybox.show(
                images.map((img: string) => ({
                  src: img,
                  type: "image",
                }))
              );
            }}
            className="absolute bottom-2 right-2 bg-[color:color-mix(in_srgb,var(--text-primary)_65%,transparent)] text-[var(--text-contrast)] text-xs md:text-sm px-3 py-1 rounded-full flex items-center gap-2 hover:bg-[color:color-mix(in_srgb,var(--text-primary)_80%,transparent)] transition"
          >
            All photos
          </button>
        )}
      </div>
    ))}
  </div>
</div>



                <div className='flex flex-col gap-4 sm:flex-row '>
                    {/* Left div  */}
                    <div className="w-full sm:w-2/3">
                        {/* About this place */}
                        <div className="pb-8 border-b border-border-subtle">
                            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-text-primary">About this place</h2>
                            <p className="text-text-muted leading-relaxed text-justify">
                                {showAboutMore
                                    ? data.property_description
                                    : `${data.property_description.slice(0, 200)}...`}
                            </p>
                            <button
                                onClick={() => setShowAboutMore(!showAboutMore)}
                                className="flex items-center mt-3 font-semibold underline hover:text-text-primary transition"
                            >
                                Show {showAboutMore ? 'Less' : 'More'}
                                <ChevronRight className={`ml-1 w-4 h-4 transition-transform ${showAboutMore ? 'rotate-90' : ''}`} />
                            </button>
                        </div>

                        {/* About neighborhood */}
                        <div className="pb-8 border-b border-border-subtle">
                            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-text-primary">About neighborhood</h2>
                            <p className="text-text-muted leading-relaxed mb-2">
                                Location & Neighborhood Located in {data.property_location}, this property offers easy access to major attractions and landmarks in the area.
                            </p>
                            {showNeighborhoodMore && (
                                <div className="text-text-muted leading-relaxed mt-3">
                                    <p className="mb-2 font-medium text-text-primary">Nearby places include:</p>
                                    <ul className="list-disc list-inside space-y-1 ml-2">
                                        {data.property_nearplaces.slice(0, 10).map((place, idx) => (
                                            <li key={idx}>{place}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <button
                                onClick={() => setShowNeighborhoodMore(!showNeighborhoodMore)}
                                className="flex items-center mt-3 font-semibold underline hover:text-text-primary transition"
                            >
                                Show {showNeighborhoodMore ? 'Less' : 'More'}
                                <ChevronRight className={`ml-1 w-4 h-4 transition-transform ${showNeighborhoodMore ? 'rotate-90' : ''}`} />
                            </button>
                        </div>

                        {/* What this place offers */}
                        <div className="pb-8 border-b border-border-subtle">
                            <h2 className="text-xl sm:text-2xl font-semibold mb-6 text-text-primary">What this place offers</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                {data.property_amenities.slice(0, 6).map((amenity, idx) => (
                                    <div key={idx} className="flex items-center gap-3 sm:gap-4">
                                        <span className="text-xl sm:text-2xl text-text-primary">{renderIcon(amenity.amenities_icon)}</span>
                                        <span className="text-text-primary text-sm sm:text-base">{formatAmenityName(amenity.amenities_icon)}</span>
                                    </div>
                                ))}
                            </div>
                            <Button
                                variant="secondary"
                                onClick={() => setShowAmenitiesModal(true)}
                                className="mt-6"
                            >
                                Show All Amenities
                            </Button>
                        </div>

                        {/* Location Map */}
                        <div className="">
                            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-text-primary">Where you'll be</h2>
                            <div className="rounded-lg overflow-hidden border border-border-subtle">
                                <iframe
                                    src={data.property_mapSrc}
                                    className="w-full h-64 sm:h-96"
                                    loading="lazy"
                                    allowFullScreen
                                    referrerPolicy="no-referrer-when-downgrade"
                                ></iframe>
                            </div>
                            <p className="mt-4 text-text-muted text-sm sm:text-base">{data.property_location}</p>
                        </div>

                        {/* Policies Section */}
                        {data.property_policy_details && (
                            <div className="border border-border-subtle rounded-lg overflow-hidden shadow-level1 bg-bg-surface">
                                <div className="bg-bg-surface p-6">
                                    <h2 className="text-xl sm:text-2xl font-semibold mb-6 text-text-primary">Things to know</h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                        <div className="p-4 border border-border-subtle rounded-lg bg-bg-muted">
                                            <p className="text-text-muted text-sm mb-1">Check-in / Check-out</p>
                                            <p className="font-medium text-text-primary">Check-in {unitPolicy.checkIn} · Check-out {unitPolicy.checkOut}</p>
                                            <a className="text-sm text-accent-primary underline" href="/terms#check-in-check-out">View terms</a>
                                        </div>
                                        <div className="p-4 border border-border-subtle rounded-lg bg-bg-muted">
                                            <p className="text-text-muted text-sm mb-1">Key policies</p>
                                            <p className="font-medium text-text-primary">{inlinePolicySnippets.cancellation}</p>
                                            <p className="text-text-primary mt-2 text-sm">{inlinePolicySnippets.houseRules}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {data.property_policy_details
                                            .filter(policy => !policy.type.includes('Policy') && !policy.type.includes('Detailed'))
                                            .map((policy, idx) => (
                                                <div key={idx}>
                                                    <p className="text-text-muted text-sm mb-1">{policy.type}</p>
                                                    <p className="font-medium text-text-primary">{policy.value}</p>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* right div  */}
                    <div className="w-full sm:w-1/3">
                        <div className='hidden lg:block sticky top-16'>
                            <HotelBooking_Form propertyId={data.id} supportPadding />
                        </div>
                        <div className="lg:hidden">
                            <HotelBooking_Form propertyId={data.id} supportPadding />
                        </div>
                    </div>
                </div>

                {/* Amenities Modal */}
                {showAmenitiesModal && (
                    <div className="fixed inset-0 bg-[color:color-mix(in_srgb,var(--text-primary)_70%,transparent)] z-[var(--z-modal)] flex items-center justify-center p-4">
                        <div className="bg-bg-surface rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-border-subtle shadow-level2">
                            <div className="flex items-center justify-between p-6 border-b border-border-subtle">
                                <h3 className="text-xl sm:text-2xl font-semibold text-text-primary">All Amenities</h3>
                                <button
                                    onClick={() => setShowAmenitiesModal(false)}
                                    className="p-2 hover:bg-bg-muted rounded-full transition"
                                >
                                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                                </button>
                            </div>

                            <div className="overflow-y-auto p-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                    {data.property_amenities.map((amenity, idx) => (
                                        <div key={idx} className="flex items-center gap-3 sm:gap-4">
                                            <span className="text-xl sm:text-2xl text-text-primary">{renderIcon(amenity.amenities_icon)}</span>
                                            <span className="text-text-primary text-sm sm:text-base">{formatAmenityName(amenity.amenities_icon)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-6 border-t border-border-subtle">
                                <Button
                                    onClick={() => setShowAmenitiesModal(false)}
                                    fullWidth
                                    variant="secondary"
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default PropertyDetails;
