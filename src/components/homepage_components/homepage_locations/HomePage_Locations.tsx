import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Slider, { Settings } from "react-slick";

import { propertyData, propertyImages } from "../../../data.ts";
import { LISTINGS, type Listing } from "../../../data/listings";
import { sanitizeItems, getItemKey } from "../../../utils/sanitizeItems";
import { LOGO_URL } from "../../../config/branding";
import { trackEvent } from "../../../utils/analytics";

import "./homepage_location.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

type HomePageLocationsProps = {
  listings?: unknown;
};

const HomePage_Locations = ({ listings = LISTINGS }: HomePageLocationsProps) => {
  const navigate = useNavigate();

  const safeListings = React.useMemo(
    () => sanitizeItems<Listing>(listings),
    [listings]
  );

  const safePropertyData = React.useMemo(() => sanitizeItems(propertyData), []);

  const fallbackCover = LOGO_URL;

  const items = React.useMemo(
    () =>
      [...safeListings].sort(
        (a, b) => Number(!!b.featured) - Number(!!a.featured)
      ),
    [safeListings]
  );

  const penthouse = items.find((item) => item.featured);
  const otherProperties = items.filter((item) => !item.featured);
  const firstRow = otherProperties.slice(0, 3);
  const secondRow = otherProperties.slice(3);

  useEffect(() => {
    trackEvent(
      "listings_browse",
      {
        total: items.length,
        featured: Number(Boolean(penthouse)),
        surface: "home_locations",
      },
      { route: "/" },
    );
  }, [items.length, penthouse]);

  const handleNavigate = (property: any) => {
    try {
      const propertyName = property.property_name || property.title || property.id;
      if (!propertyName) return;

      const slug = String(propertyName).toLowerCase().replace(/\s+/g, "-");

      trackEvent(
        "listing_selected",
        {
          surface: "home_locations",
          listingName: propertyName,
        },
        { listingId: property?.id, unitCode: property?.id, route: `/property_details/${slug}` },
      );

      navigate(`/property_details/${slug}`, {
        state: { property },
      });
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  /* ============================
      CUSTOM ARROWS
  ============================ */

  const NextArrow = ({ onClick, className }: any) => (
    <div
      className={`w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center cursor-pointer ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      ❯
    </div>
  );

  const PrevArrow = ({ onClick, className }: any) => (
    <div
      className={`w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center cursor-pointer ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      ❮
    </div>
  );

  /* ============================
      PROPERTY CARD
  ============================ */

  const PropertyCard = ({
    property,
    isPenthouse = false,
  }: {
    property: Listing;
    isPenthouse?: boolean;
  }) => {
    const listing = property;
    const propertyDataItem = safePropertyData.find(
      (p) => String(p.id) === String(listing.id)
    );

    const images = propertyImages[String(listing.id)] || [fallbackCover];
    const displayName =
      propertyDataItem?.property_name || listing.title || `Property ${listing.id}`;

    const sliderRef = useRef<Slider>(null);
    const [current, setCurrent] = useState(0);

    const sliderSettings: Settings = {
      dots: false,
      infinite: true,
      speed: 500,
      slidesToShow: 1,
      slidesToScroll: 1,
      arrows: true,
      autoplay: false,
      nextArrow: <NextArrow />,
      prevArrow: <PrevArrow />,
      beforeChange: (_old, newIndex) => setCurrent(newIndex),
    };

    // 8 dots, show 4 visible at a time, centered
    const totalDots = 8;
    const visibleDots = 4;

    const getVisibleDots = () => {
      let start = Math.max(current - Math.floor(visibleDots / 2), 0);
      if (start + visibleDots > totalDots) start = totalDots - visibleDots;
      return Array.from({ length: visibleDots }, (_, i) => start + i);
    };

    return (
      <div
        className={`bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer ${
          isPenthouse ? "lg:col-span-3" : ""
        }`}
        onClick={() => handleNavigate(propertyDataItem)}
      >
        <div className="relative slider-wrapper group">
          <Slider ref={sliderRef} {...sliderSettings}>
            {images.map((imgUrl, index) => (
              <div key={index}>
                <img
                  src={imgUrl}
                  alt={`${displayName} ${index + 1}`}
                  className="w-full h-64 object-cover rounded-b-3xl"
                />
              </div>
            ))}
          </Slider>

          {/* Arrows only visible on hover */}
          <PrevArrow className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" onClick={() => sliderRef.current?.slickPrev()} />
          <NextArrow className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" onClick={() => sliderRef.current?.slickNext()} />

          {/* Custom dots overlay */}
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-50 flex gap-2">
            {getVisibleDots().map((idx) => (
              <button
                key={idx}
                className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                  current === idx ? "bg-white" : "bg-white/50"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  sliderRef.current?.slickGoTo(idx);
                }}
              ></button>
            ))}
          </div>
        </div>

        {/* DETAILS */}
        <div className="p-4">
          <h2 className="text-xl font-bold text-gray-800 truncate">{displayName}</h2>
          <div className="text-gray-600 text-sm mt-1">Hyderabad, Telangana</div>
          <div className="flex items-center mt-2">
            <span className="text-yellow-400 text-lg">⭐</span>
            <span className="font-semibold ml-1">
              {propertyDataItem?.property_rating?.toFixed(1) || "4.8"}
            </span>
            <span className="text-gray-500 text-sm ml-1">
              ({propertyDataItem?.property_reviews || "0"} reviews)
            </span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold">
              ₹{propertyDataItem?.property_price?.toLocaleString() || "4,999"}
            </span>
            <span className="text-gray-600 text-sm ml-1">for 1 night</span>
          </div>
        </div>
      </div>
    );
  };

  /* ============================
      MAIN RETURN
  ============================ */

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="py-16 text-[#fff] md:pb-6 md:pt-8 tracking-wide flex justify-center items-center text-xl md:text-2xl lg:text-5xl font-medium relative">
          <p
            className="relative after:content-[''] bg-primary px-6 py-1 font-semibold rounded-lg 
            after:absolute after:left-0 after:-bottom-2 after:w-full after:h-[3px] 
            after:bg-primary after:rounded-full after:transition-all after:duration-500 
            after:ease-in-out hover:after:w-0 cursor-pointer"
          >
            Our Homes
          </p>
        </div>

        {penthouse && (
          <div className="mb-6 w-full">
            <PropertyCard property={penthouse} isPenthouse />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {firstRow.map((property, index) => (
            <PropertyCard key={getItemKey(property, index)} property={property} />
          ))}
        </div>

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
