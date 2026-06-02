import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import ErrorBoundary from "../components/ErrorBoundary";
import ErrorLayout from "../components/ErrorLayout";
import ListingCard from "../components/apartments/ListingCard";
import ListingFilters from "../components/apartments/ListingFilters";
import { LOGO_URL } from "../config/branding";
import { getTenantBrandName } from "../tenant/displayBrand";
import { getTenantContext } from "../tenant/tenantContext";
import { getTenantOverrides, shouldHideAtlasBranding } from "../tenant/tenantOverrides";
import type { Listing } from "../data/listings";
import { useTenantListings } from "../hooks/useTenantListings";
import { trackEvent } from "../utils/analytics";
import { buildHomeUnitPath, getPropertySlug, navigateToHomeUnit } from "../utils/navigation";
import {
  calculateNightlyPrice,
  getEffectiveDiscountPercent,
  inferUnitType,
  type NightlyPriceBreakdown,
} from "../utils/pricing";
import { estimateStayNights } from "../utils/guestPriceEstimate";
import type { UnitType } from "../config/pricing.config";

type PropertyMetadata = {
  unitType?: UnitType;
  unit_type?: UnitType;
  property_name?: string;
  property_slug?: string;
  slug?: string;
  name?: string;
};

type PropertyRecord = {
  id: number | string;
  listingId?: number | string;
  unitType?: UnitType;
  unit_type?: UnitType;
  metadata?: PropertyMetadata;
  property_metadata?: PropertyMetadata;
  property_slug?: string;
  slug?: string;
  property_name?: string;
  property_location?: string;
  property_neighborhoods?: string[];
  property_price?: number;
  property_rating?: number;
  property_reviews?: number;
  property_img?: string[];
  property_amenities?: { amenities_icon?: string }[];
  property_policy_details?: { type?: string; value?: string }[];
  property_description?: string;
};

type CombinedListing = {
  id: string;
  name: string;
  location: string;
  neighborhoods: string[];
  price: number;
  pricingBreakdown: NightlyPriceBreakdown | null;
  rating: number;
  reviews: number;
  featured: boolean;
  propertyType: string;
  guests: number;
  bedrooms: number | null;
  hasWifi: boolean;
  hasParking: boolean;
  petFriendly: boolean;
  image: string;
  property: PropertyRecord;
  /** TASK-1360: ISO date of most recent checkout within 30 days. */
  lastBookedAt?: string | null;
  /** TASK-1695: LOS auto-discount tier 1. */
  losDiscountMinNights?: number | null;
  losDiscountPercent?: number | null;
  /** TASK-1695: LOS auto-discount tier 2. */
  losDiscount2MinNights?: number | null;
  losDiscount2Percent?: number | null;
};

const derivePropertyType = (name?: string): string => {
  if (!name) return "Apartment";
  if (name.toLowerCase().includes("penthouse")) return "Penthouse";
  return "Apartment";
};

const deriveGuests = (property: PropertyRecord): number => {
  const baseOccupancy = property.property_policy_details?.find((policy) =>
    (policy.type ?? "").toLowerCase().includes("base occupancy")
  );

  const match = baseOccupancy?.value?.match(/(\d+)/);
  if (match?.[1]) return Number(match[1]);

  return 2;
};

const derivePetFriendly = (property: PropertyRecord): boolean =>
  Boolean(
    property.property_amenities?.some((amenity) =>
      (amenity.amenities_icon ?? "").toLowerCase().includes("pet")
    )
  );

const deriveBedrooms = (property: PropertyRecord): number | null => {
  const description = property.property_description ?? "";
  const bhkMatch = description.match(/(\d+)\s*bhk/i);
  if (bhkMatch?.[1]) return Number(bhkMatch[1]);

  const bedroomMatch = description.match(/(\d+)\s*(?:bedroom|bedrooms|br)\b/i);
  if (bedroomMatch?.[1]) return Number(bedroomMatch[1]);

  return null;
};

const deriveAmenityFlag = (property: PropertyRecord, keyword: string): boolean =>
  Boolean(
    property.property_amenities?.some((amenity) =>
      (amenity.amenities_icon ?? "").toLowerCase().includes(keyword)
    )
  );

const sanitizeListings = (listingsInput: unknown): Listing[] => {
  try {
    if (!listingsInput) {
      console.error("listingsSource is undefined");
      return [];
    }

    if (!Array.isArray(listingsInput)) {
      console.error("listingsSource is not an array:", listingsInput);
      return [];
    }

    if (listingsInput.length === 0) {
      console.warn("listingsSource is empty");
      return [];
    }

    return listingsInput
      .map((listing) => {
        const unitType = inferUnitType({
          ...listing,
          name: (listing as Listing).title ?? (listing as { name?: string }).name,
          unitType: (listing as Listing).unitType ?? (listing as { unit_type?: UnitType }).unit_type,
          metadata: (listing as { metadata?: { unitType?: UnitType; unit_type?: UnitType } }).metadata,
        });

        return {
          ...listing,
          unitType,
          id: String((listing as Listing | { id?: string }).id || ""),
        } satisfies Listing;
      })
      .filter((listing) => Boolean(listing.id));
  } catch (error) {
    console.error("Error processing listingsSource:", error);
    return [];
  }
};

const sanitizeProperties = (propertiesInput: unknown): PropertyRecord[] => {
  try {
    if (!propertiesInput) {
      console.error("propertiesSource is undefined");
      return [];
    }

    if (!Array.isArray(propertiesInput)) {
      console.error("propertiesSource is not an array:", propertiesInput);
      return [];
    }

    if (propertiesInput.length === 0) {
      console.warn("propertiesSource is empty");
      return [];
    }

    return propertiesInput.map((property) => {
      const baseProperty = property as PropertyRecord;
      const safeProperty: PropertyRecord = {
        id: String(baseProperty.id || ""),
        property_name: baseProperty?.property_name || `Property ${baseProperty?.id || ""}`,
        property_location: baseProperty?.property_location || "Hyderabad",
        property_neighborhoods: Array.isArray(baseProperty?.property_neighborhoods)
          ? baseProperty.property_neighborhoods
          : [],
        property_description: baseProperty?.property_description || "A comfortable place to stay",
        property_price: typeof baseProperty?.property_price === "number" ? baseProperty.property_price : 0,
        property_rating: typeof baseProperty?.property_rating === "number" ? baseProperty.property_rating : 0,
        property_reviews: typeof baseProperty?.property_reviews === "number" ? baseProperty.property_reviews : 0,
        property_img: Array.isArray(baseProperty?.property_img) ? baseProperty.property_img : [],
        property_amenities: Array.isArray(baseProperty?.property_amenities) ? baseProperty.property_amenities : [],
        property_policy_details: Array.isArray(baseProperty?.property_policy_details)
          ? baseProperty.property_policy_details
          : [],
        ...property,
      } satisfies PropertyRecord;

      const metadataUnitType =
        baseProperty?.unitType ??
        baseProperty?.unit_type ??
        baseProperty?.metadata?.unitType ??
        baseProperty?.metadata?.unit_type ??
        baseProperty?.property_metadata?.unitType ??
        baseProperty?.property_metadata?.unit_type;

      safeProperty.unitType =
        typeof metadataUnitType === "string" && metadataUnitType.trim()
          ? metadataUnitType
          : inferUnitType(safeProperty);

      if (!safeProperty.property_img || safeProperty.property_img.length === 0) {
        const hideLogo = getTenantOverrides(getTenantContext()?.slug).hideLogo;
        safeProperty.property_img = hideLogo ? [""] : [LOGO_URL];
      }

      return safeProperty;
    });
  } catch (error) {
    console.error("Error processing propertiesSource:", error);
    return [];
  }
};

export const Apartments = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    listings: listingsSource,
    properties: propertiesSource,
    state: fetchState,
    fetchErrorMessage,
    refetch: fetchData,
  } = useTenantListings();

  const tenant = getTenantContext();
  const brandName = getTenantBrandName();
  const tenantOverrides = getTenantOverrides(tenant?.slug);
  const hideAtlasBranding = shouldHideAtlasBranding(tenant, tenantOverrides);
  const directBookingDiscountPercent = React.useMemo(() => getEffectiveDiscountPercent(), []);

  const safeListings = React.useMemo(() => sanitizeListings(listingsSource), [listingsSource]);
  const safeProperties = React.useMemo(() => sanitizeProperties(propertiesSource), [propertiesSource]);

  const [guests, setGuests] = React.useState(2);
  const [checkIn, setCheckIn] = React.useState<string | null>(null);
  const [checkOut, setCheckOut] = React.useState<string | null>(null);
  const [propertyType, setPropertyType] = React.useState("all");
  const [petFriendlyOnly, setPetFriendlyOnly] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("featured");

  const computeNightlyPrice = React.useCallback(
    (property: PropertyRecord): NightlyPriceBreakdown | null => {
      const unitType = inferUnitType({ id: property.id, property_name: property.property_name });
      const referenceDate = checkIn ? new Date(checkIn) : new Date();
      const checkInDate = Number.isNaN(referenceDate.getTime()) ? new Date() : referenceDate;

      try {
        return calculateNightlyPrice({
          unitType,
          checkInDate,
          guests,
        });
      } catch (error) {
        console.warn("Unable to calculate price for listing", property.id, error);
        return null;
      }
    },
    [checkIn, guests],
  );

  const priceBounds = React.useMemo(() => {
    try {
      const prices = safeProperties
        .map((property) => {
          try {
            return computeNightlyPrice(property)?.finalNightlyPrice;
          } catch (error) {
            console.warn(`Error computing price for property ${property.id}:`, error);
            return null;
          }
        })
        .filter((price): price is number => typeof price === "number" && price > 0);

      if (prices.length === 0) {
        return { min: 0, max: 10000 };
      }

      const min = Math.min(...prices);
      const max = Math.max(...prices);

      return {
        min: Number.isFinite(min) ? min : 0,
        max: Number.isFinite(max) ? max : 10000,
      };
    } catch (error) {
      console.error('Error calculating price bounds:', error);
      return { min: 0, max: 10000 };
    }
  }, [computeNightlyPrice, safeProperties]);

  const [minPrice, setMinPrice] = React.useState(priceBounds.min);
  const [maxPrice, setMaxPrice] = React.useState(priceBounds.max);

  React.useEffect(() => {
    setMinPrice((current) => Math.max(priceBounds.min, Math.min(current, priceBounds.max)));
    setMaxPrice((current) => Math.min(priceBounds.max, Math.max(current, priceBounds.min)));
  }, [priceBounds.max, priceBounds.min]);

  const listings = React.useMemo<CombinedListing[]>(() => {
    try {
      if (!safeListings || safeListings.length === 0) {
        console.warn('No listings available');
        return [];
      }

      const merged = safeListings.map((listing) => {
        try {
          const property = safeProperties.find(
            (item) => String(item.id) === String(listing.id)
          ) || {
            id: listing.id,
            property_name: listing.title,
            property_location: 'Hyderabad',
            property_neighborhoods: [],
            property_price: 0,
            property_rating: 0,
            property_reviews: 0,
            property_amenities: [],
            property_policy_details: []
          };

          // Ensure we have a valid image URL
          const images = property.property_img || [];
          const name = property.property_name || listing.title || `Property ${listing.id}`;
          const location = property.property_location || listing.subtitle || "Hyderabad";
          const neighborhoods = property.property_neighborhoods ?? [];
          const pricing = computeNightlyPrice(property);
          const price = pricing?.finalNightlyPrice ?? 0;

          return {
            id: String(listing.id),
            name,
            location,
            neighborhoods,
            price,
            pricingBreakdown: pricing,
            rating: property.property_rating || 0,
            reviews: property.property_reviews || 0,
            featured: Boolean(listing.featured),
            propertyType: derivePropertyType(name),
            guests: deriveGuests(property),
            bedrooms: deriveBedrooms(property),
            hasWifi: deriveAmenityFlag(property, "wifi"),
            hasParking: deriveAmenityFlag(property, "park"),
            petFriendly: derivePetFriendly(property),
            image: images?.[0] ?? (getTenantOverrides(getTenantContext()?.slug).hideLogo ? "" : LOGO_URL),
            property,
            lastBookedAt: property.lastBookedAt ?? null, // TASK-1360
            losDiscountMinNights: (property as { losDiscountMinNights?: number | null }).losDiscountMinNights ?? null,
            losDiscountPercent: (property as { losDiscountPercent?: number | null }).losDiscountPercent ?? null,
            losDiscount2MinNights: (property as { losDiscount2MinNights?: number | null }).losDiscount2MinNights ?? null,
            losDiscount2Percent: (property as { losDiscount2Percent?: number | null }).losDiscount2Percent ?? null,
          };
        } catch (error) {
          console.error(`Error processing listing ${listing.id}:`, error);
          return null;
        }
      }).filter((item): item is CombinedListing => item !== null && item.price > 0);

      return merged;
    } catch (error) {
      console.error('Error creating listings:', error);
      return [];
    }
  }, [computeNightlyPrice, safeListings, safeProperties]);

  const filteredListings = React.useMemo(() => {
    let result = listings.filter(
      (listing) =>
        listing.price >= minPrice &&
        listing.price <= maxPrice &&
        listing.guests >= guests &&
        (propertyType === "all" || listing.propertyType === propertyType) &&
        (!petFriendlyOnly || listing.petFriendly)
    );

    if (sortBy === "price") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortBy === "rating") {
      result = [...result].sort((a, b) => b.rating - a.rating);
    } else {
      result = [...result].sort(
        (a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating
      );
    }

    return result;
  }, [guests, listings, maxPrice, minPrice, petFriendlyOnly, propertyType, sortBy]);

  const handleNavigate = (property: PropertyRecord) => {
    const listingId = property.listingId ?? property.id;
    const id = typeof listingId === "number" ? listingId : Number(listingId);
    if (!Number.isFinite(id) || id <= 0) return;

    const propertySlug = getPropertySlug(property);
    const canonicalPath = buildHomeUnitPath(propertySlug, id);

    trackEvent(
      "listing_selected",
      { surface: "apartments", listingName: property.property_name ?? propertySlug },
      { listingId: id, route: canonicalPath },
    );

    navigateToHomeUnit(navigate, propertySlug, id, {
      state: { property },
    });
  };

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const guestsParam = Number(params.get("guests"));
    const parsedCheckIn = params.get("checkIn");
    const parsedCheckOut = params.get("checkOut");

    const isValidDate = (value: string | null) => {
      if (!value) return false;
      const parsed = new Date(value);
      return !Number.isNaN(parsed.getTime());
    };

    const nextCheckIn = isValidDate(parsedCheckIn) ? parsedCheckIn : null;
    const nextCheckOut =
      isValidDate(parsedCheckOut) && nextCheckIn && new Date(parsedCheckOut) > new Date(nextCheckIn)
        ? parsedCheckOut
        : isValidDate(parsedCheckOut) && !nextCheckIn
          ? parsedCheckOut
          : null;

    if (guestsParam && guestsParam > 0) {
      setGuests((current) => (current === guestsParam ? current : guestsParam));
    }

    setCheckIn((current) => (nextCheckIn !== current ? nextCheckIn : current));
    setCheckOut((current) => (nextCheckOut !== current ? nextCheckOut : current));
  }, [location.search]);

  React.useEffect(() => {
    trackEvent(
      "listings_browse",
      {
        surface: "apartments",
        total: filteredListings.length,
        sortBy,
        guests,
        checkIn,
        checkOut,
        minPrice,
        maxPrice,
        propertyType,
        petFriendlyOnly,
      },
      { route: "/#our-homes" },
    );
  }, [filteredListings.length, sortBy, guests, minPrice, maxPrice, propertyType, petFriendlyOnly, checkIn, checkOut]);

  const formattedDates = React.useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      month: "short",
      day: "numeric",
    });

    const displayCheckIn = checkIn ? formatter.format(new Date(checkIn)) : null;
    const displayCheckOut = checkOut ? formatter.format(new Date(checkOut)) : null;

    return { displayCheckIn, displayCheckOut };
  }, [checkIn, checkOut]);

  const estimateNights = React.useMemo(() => {
    const ci = checkIn ? new Date(checkIn) : null;
    const co = checkOut ? new Date(checkOut) : null;
    return estimateStayNights(ci, co);
  }, [checkIn, checkOut]);

  const shouldShowEmptyState = !safeListings || safeListings.length === 0;

  if (fetchState === "error") {
    return (
      <div className="bg-bg-muted py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 md:px-8">
          <ErrorLayout
            title="We couldn’t load this page"
            description={
              fetchErrorMessage?.trim() ||
              "We're having trouble loading apartments right now. Please try again."
            }
            primaryAction={{ label: "Try again", onClick: fetchData, disabled: fetchState === "loading" }}
            secondaryAction={{ label: "Back to home", href: "/" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-muted py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 md:px-8">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{brandName}</p>
          <h1 className="text-3xl font-bold text-text-primary sm:text-4xl">Hyderabad serviced apartments</h1>
          <p className="max-w-3xl text-base text-text-muted">
            Discover beautifully furnished homes tailored for extended stays, business travel, and weekend getaways.
            Browse our curated apartments and penthouses, complete with clear pricing and trusted ratings.
          </p>
        </header>

        {shouldShowEmptyState ? (
          <div className="rounded-2xl bg-bg-surface p-8 text-center shadow-level1 border border-border-subtle">
            <h2 className="text-2xl font-semibold text-text-primary mb-2">No listings available</h2>
            <p className="text-text-muted mb-4">
              We're currently updating our listings. Please check back soon or try reloading.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={fetchData}
                className="px-6 py-3 bg-cta-primary text-[var(--text-contrast)] rounded-full hover:bg-cta-secondary transition-colors"
                disabled={fetchState === "loading"}
              >
                {fetchState === "loading" ? "Refreshing..." : "Retry loading"}
              </button>
              <Link
                to="/"
                className="inline-flex items-center justify-center px-6 py-3 bg-bg-muted text-text-primary rounded-full hover:bg-border-subtle transition-colors font-medium"
              >
                Go to Home
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-bg-surface p-4 shadow-level1 border border-border-subtle text-sm text-text-muted">
              <p className="text-base font-semibold text-text-primary">Trip details</p>
              <p className="mt-1 flex flex-wrap gap-2">
                <span className="rounded-full bg-bg-muted px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-text-primary">
                  Guests: {guests}
                </span>
                {formattedDates.displayCheckIn && (
                  <span className="rounded-full bg-bg-muted px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-text-primary">
                    Check-in: {formattedDates.displayCheckIn}
                  </span>
                )}
                {formattedDates.displayCheckOut && (
                  <span className="rounded-full bg-bg-muted px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-text-primary">
                    Check-out: {formattedDates.displayCheckOut}
                  </span>
                )}
                {!formattedDates.displayCheckIn && !formattedDates.displayCheckOut && (
                  <span>Adjust dates anytime to refine the availability you see.</span>
                )}
              </p>
            </div>

            <ListingFilters
              priceMin={priceBounds.min}
              priceMax={priceBounds.max}
              selectedMinPrice={minPrice}
              selectedMaxPrice={maxPrice}
              guests={guests}
              propertyType={propertyType}
              petFriendlyOnly={petFriendlyOnly}
              sortBy={sortBy}
              onPriceChange={(field, value) => {
                if (field === "min") {
                  setMinPrice(Math.max(priceBounds.min, Math.min(value, maxPrice)));
                } else {
                  setMaxPrice(Math.min(priceBounds.max, Math.max(value, minPrice)));
                }
              }}
              onGuestsChange={(value) => setGuests(Math.max(1, value))}
              onPropertyTypeChange={setPropertyType}
              onPetFriendlyChange={setPetFriendlyOnly}
              onSortChange={setSortBy}
            />

            <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {filteredListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  id={listing.id}
                  name={listing.name}
                  location={listing.location}
                  neighborhoods={listing.neighborhoods}
                  image={listing.image}
                  price={listing.price}
                  pricingBreakdown={listing.pricingBreakdown}
                  rating={listing.rating}
                  reviews={listing.reviews}
                  propertyType={listing.propertyType}
                  guests={listing.guests}
                  bedrooms={listing.bedrooms}
                  hasWifi={listing.hasWifi}
                  hasParking={listing.hasParking}
                  petFriendly={listing.petFriendly}
                  lastBookedAt={listing.lastBookedAt ?? undefined}
                  losDiscountMinNights={listing.losDiscountMinNights}
                  losDiscountPercent={listing.losDiscountPercent}
                  losDiscount2MinNights={listing.losDiscount2MinNights}
                  losDiscount2Percent={listing.losDiscount2Percent}
                  directBookingDiscountPercent={directBookingDiscountPercent}
                  estimateNights={estimateNights}
                  onClick={() => handleNavigate(listing.property)}
                />
              ))}
            </section>

            {filteredListings.length === 0 && (
              <div className="rounded-2xl bg-bg-surface p-6 text-center shadow-sm border border-border-subtle">
                <h2 className="text-xl font-semibold text-text-primary">No homes match these filters</h2>
                <p className="mt-2 text-text-muted">Try adjusting your price range or guest count to see more options.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Wrap the component with the error boundary
export default function ApartmentsWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <Apartments />
    </ErrorBoundary>
  );
}
