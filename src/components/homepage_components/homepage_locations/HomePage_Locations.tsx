import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import Heading from "../../commonComponents/heading/Heading";
import { LISTINGS, type Listing } from "../../../data/listings";
import { propertyData, propertyImages } from "../../../data";
import priceDisplayConfig from "../../../config/priceDisplay.config";
import { calculateNightlyPrice, inferUnitType } from "../../../utils/pricing";
import { sanitizeItems, getItemKey } from "../../../utils/sanitizeItems";
import { trackEvent } from "../../../utils/analytics";

import "./homepage_location.css";

type HomePageLocationsProps = {
  listings?: unknown;
};

type PropertyRecord = (typeof propertyData)[number];

type ListingModel = {
  listing: Listing;
  property?: PropertyRecord;
  images: string[];
  price?: ReturnType<typeof calculateNightlyPrice>;
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80";

const formatAmenityName = (value?: string) =>
  (value ?? "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

const buildSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

const useSearchSelections = (search: string) => {
  return React.useMemo(() => {
    const params = new URLSearchParams(search);

    const parseDate = (value: string | null) => {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    };

    const parseGuests = (value: string | null) => {
      if (!value) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };

    const checkIn = parseDate(params.get("checkIn"));
    const checkOut = parseDate(params.get("checkOut"));
    const guests = parseGuests(params.get("guests"));

    const normalizedCheckOut =
      checkOut && checkIn && new Date(checkOut) <= new Date(checkIn) ? null : checkOut;

    const nextSearch = new URLSearchParams();
    if (checkIn) nextSearch.set("checkIn", checkIn);
    if (normalizedCheckOut) nextSearch.set("checkOut", normalizedCheckOut);
    if (guests) nextSearch.set("guests", String(guests));

    return {
      checkIn,
      checkOut: normalizedCheckOut,
      guests,
      searchString: nextSearch.toString(),
    };
  }, [search]);
};

const createListingModel = (
  listing: Listing,
  propertyLookup: Record<string, PropertyRecord>,
  checkInDate: string | null,
  guests: number | null,
): ListingModel => {
  const property = propertyLookup[listing.id];
  const images = propertyImages[listing.id] ?? property?.property_img ?? [FALLBACK_IMAGE];

  let price: ListingModel["price"];

  try {
    price = calculateNightlyPrice({
      unitType: inferUnitType(property ?? { id: listing.id, name: listing.title }),
      checkInDate: checkInDate ?? new Date(),
      guests: guests ?? undefined,
    });
  } catch (error) {
    console.warn("Failed to compute nightly price", error);
    price = undefined;
  }

  return { listing, property, images, price };
};

const HomePage_Locations: React.FC<HomePageLocationsProps> = ({ listings }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { checkIn, checkOut, guests, searchString } = useSearchSelections(location.search);
  const [activeImageIndex, setActiveImageIndex] = React.useState<Record<string, number>>({});

  const propertyLookup = React.useMemo(
    () =>
      propertyData.reduce<Record<string, PropertyRecord>>((acc, property) => {
        acc[String(property.id)] = property;
        return acc;
      }, {}),
    [],
  );

  const safeListings = React.useMemo(
    () => sanitizeItems<Listing>(listings ?? LISTINGS),
    [listings],
  );

  const sortedListings = React.useMemo(
    () => [...safeListings].sort((a, b) => Number(b.featured) - Number(a.featured)),
    [safeListings],
  );

  const heroListing = sortedListings.find((item) => item.featured) ?? sortedListings[0];
  const otherListings = sortedListings.filter((item) => item !== heroListing);

  const heroModel = React.useMemo(
    () => (heroListing ? createListingModel(heroListing, propertyLookup, checkIn, guests) : null),
    [checkIn, guests, heroListing, propertyLookup],
  );

  const listingModels = React.useMemo(
    () =>
      otherListings.map((item) => createListingModel(item, propertyLookup, checkIn, guests)),
    [checkIn, guests, otherListings, propertyLookup],
  );

  React.useEffect(() => {
    if (!sortedListings.length) return;

    trackEvent(
      "listings_browse",
      {
        surface: "home_locations",
        total: sortedListings.length,
        checkIn,
        checkOut,
        guests,
      },
      { route: `/${searchString ? `?${searchString}` : ""}#our-homes` },
    );
  }, [checkIn, checkOut, guests, searchString, sortedListings.length]);

  const handleNavigate = React.useCallback(
    (model: ListingModel | null) => {
      if (!model) return;

      const propertyName = model.property?.property_name ?? model.listing.title;
      const slug = buildSlug(propertyName);
      const path = `/property_details/${slug}`;
      const nextSearch = searchString ? `?${searchString}` : "";

      trackEvent(
        "listing_selected",
        {
          surface: "home_locations",
          listingName: propertyName,
          checkIn,
          checkOut,
          guests,
        },
        { listingId: model.property?.id ?? model.listing.id, unitCode: model.listing.id, route: `${path}${nextSearch}` },
      );

      navigate(
        { pathname: path, search: nextSearch },
        { state: { property: model.property ?? undefined } },
      );
    },
    [checkIn, checkOut, guests, navigate, searchString],
  );

  const handleSlideChange = (id: string, direction: "next" | "prev", imagesLength: number) => {
    setActiveImageIndex((prev) => {
      const current = prev[id] ?? 0;
      const nextIndex = direction === "next" ? current + 1 : current - 1;
      const normalized = (nextIndex + imagesLength) % imagesLength;
      return { ...prev, [id]: normalized };
    });
  };

  const renderPrice = (model: ListingModel) => {
    if (!model.price) return null;

    const { baseNightlyPrice, finalNightlyPrice, currency, appliedDiscountPercent, hasSpecialDateMultiplier, dateKey } =
      model.price;

    const formatter = new Intl.NumberFormat("en-IN", { style: "currency", currency });
    const formattedBase = formatter.format(baseNightlyPrice);
    const formattedFinal = formatter.format(finalNightlyPrice);
    const specialLabel = priceDisplayConfig.specialPricingLabels[dateKey];

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold rounded-full bg-[color:color-mix(in_srgb,var(--cta-primary)_18%,transparent)] px-3 py-1 text-[color:color-mix(in_srgb,var(--cta-primary)_80%,transparent)]">
            {priceDisplayConfig.discount.primaryBadgeLabel}
          </span>
          <span className="text-xs text-text-muted">{priceDisplayConfig.discount.secondaryBadgeLabel}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-text-primary">{formattedFinal}</span>
          {appliedDiscountPercent > 0 && (
            <span className="text-sm text-text-muted line-through">{formattedBase}</span>
          )}
          {appliedDiscountPercent > 0 && (
            <span className="text-sm font-semibold text-[color:color-mix(in_srgb,var(--cta-primary)_80%,transparent)]">
              {priceDisplayConfig.discount.savingsPrefix} {appliedDiscountPercent}%
            </span>
          )}
        </div>
        {(hasSpecialDateMultiplier || specialLabel) && (
          <p className="text-xs font-medium text-[color:color-mix(in_srgb,var(--cta-primary)_85%,transparent)]">
            {specialLabel ?? priceDisplayConfig.defaultSpecialLabel}
          </p>
        )}
      </div>
    );
  };

  const renderAmenities = (property?: PropertyRecord) => {
    if (!property?.property_amenities?.length) return null;

    return (
      <ul className="grid grid-cols-2 gap-2 text-sm text-text-secondary">
        {property.property_amenities.slice(0, 6).map((amenity, index) => (
          <li key={`${amenity.amenities_icon}-${index}`} className="flex items-center gap-2">
            <span className="text-lg">•</span>
            <span>{formatAmenityName(amenity.amenities_icon)}</span>
          </li>
        ))}
      </ul>
    );
  };

  if (!heroModel) {
    return null;
  }

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 bg-bg-surface scroll-mt-28" id="our-homes">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        <Heading title="Our Homes" id="our-homes" />

        <div className="grid gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch rounded-3xl overflow-hidden shadow-level2 bg-white border border-border-subtle">
            <div className="relative h-full">
              <img
                src={heroModel.images[activeImageIndex[heroModel.listing.id] ?? 0] ?? FALLBACK_IMAGE}
                alt={heroModel.listing.title}
                className="w-full h-full object-cover min-h-[280px]"
                loading="lazy"
              />
              {heroModel.images.length > 1 && (
                <div className="absolute inset-0 flex items-center justify-between px-4">
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={() => handleSlideChange(heroModel.listing.id, "prev", heroModel.images.length)}
                    className="rounded-full bg-[color:color-mix(in_srgb,var(--bg-surface)_80%,transparent)] p-2 shadow"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={() => handleSlideChange(heroModel.listing.id, "next", heroModel.images.length)}
                    className="rounded-full bg-[color:color-mix(in_srgb,var(--bg-surface)_80%,transparent)] p-2 shadow"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[color:color-mix(in_srgb,var(--cta-primary)_12%,transparent)] px-3 py-1 text-xs font-semibold text-[color:color-mix(in_srgb,var(--cta-primary)_80%,transparent)]">
                  Featured
                </span>
                <span className="text-xs uppercase tracking-[0.08em] font-semibold text-text-muted">Penthouse</span>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">Atlas Homes</p>
                <h3 className="text-3xl font-bold text-text-primary">{heroModel.listing.title}</h3>
                {heroModel.listing.subtitle && (
                  <p className="text-base text-text-secondary mt-1">{heroModel.listing.subtitle}</p>
                )}
              </div>

              {renderPrice(heroModel)}

              {renderAmenities(heroModel.property)}

              <div className="flex gap-3 flex-wrap mt-auto">
                <button
                  type="button"
                  onClick={() => handleNavigate(heroModel)}
                  className="inline-flex items-center justify-center rounded-full bg-[color:var(--cta-primary)] px-5 py-3 text-sm font-semibold text-white shadow-level2 transition hover:-translate-y-0.5"
                >
                  Check availability
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate(heroModel)}
                  className="inline-flex items-center justify-center rounded-full border border-border-subtle px-5 py-3 text-sm font-semibold text-text-primary transition hover:border-[color:var(--cta-primary)] hover:text-[color:var(--cta-primary)]"
                >
                  View details
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listingModels.map((model, index) => {
              const activeIndex = activeImageIndex[model.listing.id] ?? 0;
              const imageSrc = model.images[activeIndex] ?? FALLBACK_IMAGE;

              return (
                <div
                  key={getItemKey(model.listing, index)}
                  className="rounded-2xl shadow-level1 bg-white overflow-hidden border border-border-subtle flex flex-col"
                >
                  <div className="relative h-56">
                    <img
                      src={imageSrc}
                      alt={model.listing.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(event) => {
                        const target = event.currentTarget;
                        if (target.src !== FALLBACK_IMAGE) {
                          target.src = FALLBACK_IMAGE;
                        }
                      }}
                    />
                    {model.images.length > 1 && (
                      <div className="absolute inset-0 flex items-center justify-between px-3">
                        <button
                          type="button"
                          aria-label="Previous image"
                          onClick={() => handleSlideChange(model.listing.id, "prev", model.images.length)}
                          className="rounded-full bg-[color:color-mix(in_srgb,var(--bg-surface)_80%,transparent)] p-2 shadow"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          aria-label="Next image"
                          onClick={() => handleSlideChange(model.listing.id, "next", model.images.length)}
                          className="rounded-full bg-[color:color-mix(in_srgb,var(--bg-surface)_80%,transparent)] p-2 shadow"
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Atlas Homes</p>
                      <h3 className="text-lg font-semibold text-text-primary">{model.listing.title}</h3>
                      {model.listing.subtitle && (
                        <p className="text-sm text-text-secondary mt-1">{model.listing.subtitle}</p>
                      )}
                    </div>

                    {renderPrice(model)}

                    {renderAmenities(model.property)}

                    <div className="flex gap-3 flex-wrap mt-auto">
                      <button
                        type="button"
                        onClick={() => handleNavigate(model)}
                        className="inline-flex items-center justify-center rounded-full bg-[color:var(--cta-primary)] px-4 py-2 text-sm font-semibold text-white shadow-level1 transition hover:-translate-y-0.5"
                      >
                        Book now
                      </button>
                      <Link
                        to={{ pathname: `/property_details/${buildSlug(model.listing.title)}`, search: searchString ? `?${searchString}` : "" }}
                        onClick={(event) => {
                          event.preventDefault();
                          handleNavigate(model);
                        }}
                        className="inline-flex items-center justify-center rounded-full border border-border-subtle px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-[color:var(--cta-primary)] hover:text-[color:var(--cta-primary)]"
                      >
                        View details
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomePage_Locations;
