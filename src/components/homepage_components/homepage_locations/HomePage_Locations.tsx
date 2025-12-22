import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Slider, { Settings } from "react-slick";
import { Bath, Snowflake, Wifi } from "lucide-react";

import { propertyData, propertyImages } from "../../../data.ts";
import { LISTINGS, type Listing } from "../../../data/listings";
import { sanitizeItems, getItemKey } from "../../../utils/sanitizeItems";
import { LOGO_URL } from "../../../config/branding";
import { trackEvent } from "../../../utils/analytics";
import { calculateNightlyPrice, inferUnitType } from "../../../utils/pricing";
import { priceDisplayConfig } from "../../../config/priceDisplay.config";
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

  const heroSearchParams = useMemo(() => {
    try {
      const stored = localStorage.getItem("atlasHeroSearch");
      if (!stored) return null;
      const parsed = JSON.parse(stored) as { checkIn?: string; checkOut?: string; guests?: number };
      if (!parsed.checkIn || !parsed.checkOut) return null;
      return {
        checkIn: parsed.checkIn,
        checkOut: parsed.checkOut,
        guests: parsed.guests && parsed.guests > 0 ? parsed.guests : 2,
      };
    } catch {
      return null;
    }
  }, []);

  const AMENITY_MAP: Record<string, string[]> = useMemo(
    () => ({
      "501": ["Wi-Fi", "Air conditioning", "Private bath"],
      "201": ["Wi-Fi", "Air conditioning"],
      "202": ["Wi-Fi", "Air conditioning"],
      "301": ["Wi-Fi", "Air conditioning"],
      "101": ["Wi-Fi", "Air conditioning"],
      "102": ["Wi-Fi", "Air conditioning"],
      "302": ["Wi-Fi", "Air conditioning"],
    }),
    []
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

  const handleNavigate = (property: any, query?: string) => {
    try {
      const propertyName = property.property_name || property.title || property.id;
      if (!propertyName) return;

      const slug = String(propertyName).toLowerCase().replace(/\s+/g, "-");
      const path = query ? `/property_details/${slug}?${query}` : `/property_details/${slug}`;

      trackEvent(
        "listing_selected",
        {
          surface: "home_locations",
          listingName: propertyName,
        },
        { listingId: property?.id, unitCode: property?.id, route: `/property_details/${slug}` },
      );

      navigate(path, {
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

    const totalDots = images.length;
    const visibleDots = Math.min(4, totalDots);

    const getVisibleDots = () => {
      if (totalDots === 0) return [];
      let start = Math.max(current - Math.floor((visibleDots - 1) / 2), 0);
      if (start + (visibleDots - 1) >= totalDots) start = Math.max(totalDots - visibleDots, 0);
      return Array.from({ length: visibleDots }, (_, i) => start + i);
    };

    const formatCurrency = (value?: number | null) =>
      value != null
        ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)
        : null;

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

    const hasSpecialPricing = Boolean(nightlyPrice?.hasSpecialDateMultiplier);
    const specialPricingLabel =
      hasSpecialPricing && nightlyPrice?.dateKey
        ? priceDisplayConfig.specialPricingLabels[nightlyPrice.dateKey] ?? priceDisplayConfig.defaultSpecialLabel
        : hasSpecialPricing
          ? priceDisplayConfig.defaultSpecialLabel
          : null;
    const showDiscount =
      Boolean(nightlyPrice?.discountAmount) &&
      !hasSpecialPricing &&
      (nightlyPrice?.discountAmount ?? 0) > 0;
    const savingsAmount = showDiscount ? nightlyPrice?.discountAmount ?? 0 : 0;
    const badgeLabel =
      showDiscount
        ? priceDisplayConfig.discount.primaryBadgeLabel
        : specialPricingLabel || null;

    const amenities = AMENITY_MAP[String(listing.id)] ?? [];

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
          {totalDots > 1 && (
            <div className="absolute bottom-3 left-1/2 z-[var(--z-overlay)] flex -translate-x-1/2 transform items-center gap-2 opacity-80 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-80 md:group-focus-within:opacity-80">
              {getVisibleDots().map((idx) => (
                <button
                  key={idx}
                  className={`h-2.5 w-2.5 rounded-full transition-colors duration-300 ${
                    current === idx
                      ? "bg-[color:var(--text-contrast)]"
                      : "bg-[color:color-mix(in_srgb,var(--text-contrast)_55%,transparent)]"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    sliderRef.current?.slickGoTo(idx);
                  }}
                  aria-label={`Go to image ${idx + 1} of ${totalDots}`}
                ></button>
              ))}
            </div>
          )}
        </div>

        {/* DETAILS */}
        <div className="p-4">
          <h2 className="text-xl font-bold text-text-primary truncate">{displayName}</h2>
          <div className="text-text-muted text-sm mt-1">Hyderabad, Telangana</div>
          <div className="mt-2 flex items-center">
            <span className="text-accent-primary text-lg">⭐</span>
            <span className="font-semibold ml-1">
              {propertyDataItem?.property_rating?.toFixed(1) || "4.8"}
            </span>
            <span className="text-text-muted text-sm ml-1">
              ({propertyDataItem?.property_reviews || "0"} reviews)
            </span>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex flex-col gap-1 text-sm text-text-muted">
              <div className="flex flex-wrap items-baseline gap-2">
                {showDiscount && (
                  <span className="text-xs font-semibold text-text-muted line-through">
                    {formatCurrency(nightlyPrice?.baseNightlyPrice) ?? "₹3,500"}
                  </span>
                )}
                <div className="text-2xl font-bold leading-tight text-cta-primary">
                  {formatCurrency(nightlyPrice?.finalNightlyPrice) ?? "₹4,999"}
                  <span className="ml-1 text-sm font-semibold text-text-muted">/ night</span>
                </div>
              </div>
              {showDiscount && savingsAmount > 0 && (
                <span className="text-xs font-semibold text-cta-primary">
                  {priceDisplayConfig.discount.savingsPrefix} {formatCurrency(savingsAmount) ?? "₹175"}
                </span>
              )}
              {badgeLabel && (
                <span className="inline-flex w-fit items-center rounded-full bg-[color:color-mix(in_srgb,var(--cta-primary)_12%,transparent)] px-3 py-1 text-[11px] font-semibold text-cta-primary">
                  {badgeLabel}
                </span>
              )}
            </div>

            {amenities.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-text-primary">
                {amenities.slice(0, 3).map((amenity) => (
                  <span key={amenity} className="inline-flex items-center gap-1">
                    {amenity.toLowerCase().includes("wi-fi") ? (
                      <Wifi className="h-4 w-4" aria-hidden />
                    ) : amenity.toLowerCase().includes("air") ? (
                      <Snowflake className="h-4 w-4" aria-hidden />
                    ) : (
                      <Bath className="h-4 w-4" aria-hidden />
                    )}
                    <span className="truncate max-w-[140px]">{amenity}</span>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[color:var(--brand)] px-4 py-2 text-sm font-semibold text-[color:var(--text-contrast)] shadow-level1 transition duration-150 hover:-translate-y-0.5 hover:shadow-level2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
                aria-label={`View room ${displayName}`}
                onClick={(event) => {
                  event.stopPropagation();
                  handleNavigate(propertyDataItem);
                }}
              >
                View room
              </button>
              {heroSearchParams && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-border-subtle px-3 py-2 text-sm font-semibold text-text-primary transition duration-150 hover:-translate-y-0.5 hover:border-[color:var(--text-primary)] hover:shadow-level1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
                  aria-label={`Check dates for ${displayName}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    const params = new URLSearchParams({
                      checkIn: heroSearchParams.checkIn,
                      checkOut: heroSearchParams.checkOut,
                      guests: heroSearchParams.guests.toString(),
                    });
                    handleNavigate(propertyDataItem, params.toString());
                  }}
                >
                  Check dates
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ============================
      MAIN RETURN
  ============================ */

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 bg-bg-surface scroll-mt-28" id="our-homes">
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
