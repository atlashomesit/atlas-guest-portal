import React from "react";
import { useNavigate } from "react-router-dom";
import { propertyData, propertyImages } from "../../../data.ts";
import { LISTINGS, type Listing } from "../../../data/listings";
import "./homepage_location.css";
import { getItemKey, sanitizeItems } from "../../../utils/sanitizeItems";
import logo from "../../../assets/logo.svg";

type HomePageLocationsProps = {
  listings?: unknown;
};

const HomePage_Locations = ({ listings = LISTINGS }: HomePageLocationsProps) => {
  const navigate = useNavigate();
  const safeListings = React.useMemo(() => sanitizeItems<Listing>(listings), [listings]);
  const safePropertyData = React.useMemo(() => sanitizeItems(propertyData), []);
  const fallbackCover = logo;

  // Sort items to have featured (penthouse) first
  const items = React.useMemo(
    () => [...safeListings].sort((a, b) => Number(!!b.featured) - Number(!!a.featured)),
    [safeListings]
  );

  // Get the penthouse and other properties
  const penthouse = items.find(item => item.featured);
  const otherProperties = items.filter(item => !item.featured);

  // Split other properties into chunks for different rows
  // First row will have 3 cards, second row will have remaining cards
  const firstRow = otherProperties.slice(0, 3);
  const secondRow = otherProperties.slice(3);

  const handleNavigate = (property: any) => {
    try {
      // Use property_name if available, otherwise fall back to title or id
      const propertyName = property.property_name || property.title || property.id;
      if (!propertyName) {
        console.error('No property name found for navigation:', property);
        return;
      }
      const slug = String(propertyName).toLowerCase().replace(/\s+/g, "-");
      console.log('Navigating to property:', { slug, property });
      navigate(`/property_details/${slug}`, { state: { property } });
    } catch (error) {
      console.error('Error navigating to property:', error, property);
    }
  };

  const PropertyCard = ({ property: propertyItem, isPenthouse = false }: { property: Listing, isPenthouse?: boolean }) => {
    const listing = propertyItem;

    const propertyDataItem = safePropertyData.find((p) => String(p.id) === String(listing.id));
    const imgs = propertyImages[String(listing.id)] || [];
    const cover = imgs[0] || fallbackCover;
    const displayName = propertyDataItem?.property_name || listing.title || `Property ${listing.id}`;

    const interactiveProps: React.HTMLAttributes<HTMLElement> = propertyDataItem
      ? {
          onClick: () => handleNavigate(propertyDataItem),
          role: "link",
          tabIndex: 0,
          onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleNavigate(propertyDataItem);
            }
          },
        }
      : {};

    return (
      <div 
        className={`bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer ${isPenthouse ? 'lg:col-span-3' : ''}`}
        {...interactiveProps}
      >
        <div className="relative">
          <img
            src={cover}
            alt={`${displayName} cover`}
            className="w-full h-64 object-cover rounded-b-3xl"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null; // Prevent infinite loop if fallback also fails
              target.src = `https://atlashomestorage.blob.core.windows.net/listing-images/fallback.jpg`;
              target.className = "w-full h-64 object-contain bg-gray-100 rounded-b-3xl p-4";
            }}
          />
          <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full text-sm font-semibold">
            {isPenthouse ? 'Featured' : 'Available'}
          </div>
        </div>
        <div className="p-4">
          <h2 className="text-xl font-bold text-gray-800 truncate">{displayName}</h2>
          <div className="text-gray-600 text-sm mt-1">Hyderabad, Telangana</div>
          <div className="flex items-center mt-2">
            <span className="text-yellow-400 text-lg">⭐</span>
            <span className="font-semibold ml-1">{propertyDataItem?.property_rating?.toFixed(1) || '4.8'}</span>
            <span className="text-gray-500 text-sm ml-1">({propertyDataItem?.property_reviews || '0'} reviews)</span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold">₹{propertyDataItem?.property_price?.toLocaleString() || '4,999'}</span>
            <span className="text-gray-600 text-sm ml-1">for 1 night</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="py-16 text-[#fff] md:pb-6 md:pt-8 tracking-wide flex justify-center items-center text-xl md:text-2xl lg:text-5xl font-medium relative">
  
  <p className="relative after:content-[''] bg-primary px-6 py-1 font-semibold rounded-lg 
             after:absolute after:left-0 after:-bottom-2 after:w-full after:h-[3px] 
             after:bg-primary after:rounded-full after:transition-all after:duration-500 
             after:ease-in-out hover:after:w-0 cursor-pointer">
      Our Homes
  </p>

</div>
        {/* Penthouse Row - Full width */}
        {penthouse && (
          <div className="mb-6 w-full">
            <PropertyCard property={penthouse} isPenthouse={true} />
          </div>
        )}
        
        {/* First Row - 3 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {firstRow.map((property, index) => (
            <PropertyCard key={getItemKey(property, index)} property={property} />
          ))}
        </div>
        
        {/* Second Row - Remaining cards */}
        {secondRow.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {secondRow.map((property, index) => (
              <PropertyCard key={getItemKey(property, index)} property={property} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HomePage_Locations;
