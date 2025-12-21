import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Slider, { Settings } from "react-slick";

import { propertyData, propertyImages } from "../../../data.ts";
import { LISTINGS, type Listing } from "../../../data/listings";
import { sanitizeItems, getItemKey } from "../../../utils/sanitizeItems";
import { LOGO_URL } from "../../../config/branding";
import { trackEvent } from "../../../utils/analytics";
import { calculateNightlyPrice, inferUnitType } from "../../../utils/pricing";
import Heading from "../../commonComponents/heading/Heading";

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
      className={`w-8 h-8 text-[color:var(--text-contrast)] rounded-full flex items-center justify-center cursor-pointer ${className}`}
      style={{
        background:
          "color-mix(in srgb, var(--text-primary) 62%, transparent)",
        boxShadow: "0 8px 18px color-mix(in srgb, var(--text-primary) 28%, transparent)",
        backdropFilter: "blur(2px)",
      }}
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
      className={`w-8 h-8 text-[color:var(--text-contrast)] rounded-full flex items-center justify-center cursor-pointer ${className}`}
      style={{
        background:
          "color-mix(in srgb, var(--text-primary) 62%, transparent)",
        boxShadow: "0 8px 18px color-mix(in srgb, var(--text-primary) 28%, transparent)",
        backdropFilter: "blur(2px)",
      }}
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
      let start = Math.max(current - Math.floor(visibleDots - 1) / 2, 0);
      if (start + (visibleDots-1) > totalDots) start = totalDots - (visibleDots-1);
      return Array.from({ length: visibleDots - 1 }, (_, i) => start + i);
    };

    const nightlyPrice = React.useMemo(() => {
      try {
        const unitType = inferUnitType({
          id: propertyDataItem?.id ?? listing.id,
          property_name: propertyDataItem?.property_name ?? displayName,
        });

        return calculateNightlyPrice({
          unitType,
          checkInDate: new Date(),
          guests: 2,
        });
      } catch (error) {
        console.warn("Unable to derive nightly price for property", listing.id, error);
        return null;
      }
    }, [displayName, listing.id, propertyDataItem?.id, propertyDataItem?.property_name]);

    return (
      <div
        className={`bg-bg-surface rounded-2xl overflow-hidden shadow-level1 hover:shadow-level2 transition-shadow duration-300 cursor-pointer border border-border-subtle ${
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
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-[var(--z-overlay)] flex gap-2 items-center">
            {getVisibleDots().map((idx) => (
              <button
                key={idx}
                className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                  current === idx ? "bg-[color:var(--text-contrast)]" : "bg-[color:color-mix(in_srgb,var(--text-contrast)_50%,transparent)]"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  sliderRef.current?.slickGoTo(idx);
                }}
              ></button>
            ))}
            <button
  className="w-6 h-6 flex items-center justify-center text-white"
  onClick={(e) => {
    e.stopPropagation();
    sliderRef.current?.slickPlay();
  }}
>
  ▶
</button>

          </div>
        </div>

        {/* DETAILS */}
        <div className="p-4">
          <h2 className="text-xl font-bold text-text-primary truncate">{displayName}</h2>
          <div className="text-text-muted text-sm mt-1">Hyderabad, Telangana</div>
          <div className="flex items-center mt-2">
            <span className="text-accent-primary text-lg">⭐</span>
            <span className="font-semibold ml-1">
              {propertyDataItem?.property_rating?.toFixed(1) || "4.8"}
            </span>
            <span className="text-text-muted text-sm ml-1">
              ({propertyDataItem?.property_reviews || "0"} reviews)
            </span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold">
                ₹{nightlyPrice?.finalNightlyPrice?.toLocaleString("en-IN") || "4,999"}
              </span>
              <span className="text-text-muted text-sm">per night</span>
            </div>
            <p className="text-xs text-text-muted">
              Base ₹{nightlyPrice?.baseNightlyPrice?.toLocaleString("en-IN") || "3,500"} · Discount ({nightlyPrice?.appliedDiscountPercent ?? 0}%)
            </p>
            {nightlyPrice?.isNewYearsEve && (
              <span className="inline-flex items-center rounded-full bg-[color:var(--bg-muted)] px-2 py-1 text-[11px] font-semibold text-cta-primary">
                New Year’s Eve pricing (2×)
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ============================
      MAIN RETURN
  ============================ */

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 bg-bg-surface">
      <div className="max-w-7xl mx-auto">
        <Heading title="Our Homes" />

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
