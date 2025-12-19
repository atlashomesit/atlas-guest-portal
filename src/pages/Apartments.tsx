import React from "react";
import { useNavigate } from "react-router-dom";

import { LOGO_URL } from "../config/branding";
import { propertyData, propertyImages } from "../data";
import { LISTINGS, type Listing } from "../data/listings";
import ListingCard from "../components/apartments/ListingCard";
import ListingFilters from "../components/apartments/ListingFilters";
import { sanitizeItems } from "../utils/sanitizeItems";
import { trackEvent } from "../utils/analytics";

type PropertyRecord = {
  id: number | string;
  property_name?: string;
  property_location?: string;
  property_price?: number;
  property_rating?: number;
  property_reviews?: number;
  property_img?: string[];
  property_amenities?: { amenities_icon?: string }[];
  property_policy_details?: { type?: string; value?: string }[];
};

type CombinedListing = {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  reviews: number;
  featured: boolean;
  propertyType: string;
  guests: number;
  petFriendly: boolean;
  image: string;
  property: PropertyRecord;
};

const derivePropertyType = (name?: string): string => {
  if (!name) return "Apartment";
  if (name.toLowerCase().includes("penthouse")) return "Penthouse";
  return "Apartment";
};

const deriveGuests = (property: PropertyRecord): number => {
  const baseOccupancy = property.property_policy_details?.find((policy) =>
    policy.type?.toLowerCase().includes("base occupancy")
  );

  const match = baseOccupancy?.value?.match(/(\d+)/);
  if (match?.[1]) return Number(match[1]);

  return 2;
};

const derivePetFriendly = (property: PropertyRecord): boolean =>
  Boolean(
    property.property_amenities?.some((amenity) =>
      amenity.amenities_icon?.toLowerCase().includes("pet")
    )
  );

const Apartments = () => {
  const navigate = useNavigate();

  const safeListings = React.useMemo(
    () => sanitizeItems<Listing>(LISTINGS),
    []
  );

  const safeProperties = React.useMemo(
    () => sanitizeItems<PropertyRecord>(propertyData),
    []
  );

  const priceBounds = React.useMemo(() => {
    const prices = safeProperties
      .map((property) => property.property_price)
      .filter((price): price is number => typeof price === "number");

    const min = Math.min(...prices);
    const max = Math.max(...prices);

    return {
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 10000,
    };
  }, [safeProperties]);

  const [minPrice, setMinPrice] = React.useState(priceBounds.min);
  const [maxPrice, setMaxPrice] = React.useState(priceBounds.max);
  const [guests, setGuests] = React.useState(2);
  const [propertyType, setPropertyType] = React.useState("all");
  const [petFriendlyOnly, setPetFriendlyOnly] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("featured");

  const listings = React.useMemo<CombinedListing[]>(() => {
    const merged = safeListings.map((listing) => {
      const property = safeProperties.find(
        (item) => String(item.id) === String(listing.id)
      ) || { id: listing.id };

      const images = property.property_img || propertyImages[String(listing.id)];
      const name = property.property_name || listing.title || `Property ${listing.id}`;
      const location = property.property_location || listing.subtitle || "Hyderabad";

      return {
        id: String(listing.id),
        name,
        location,
        price: property.property_price || 0,
        rating: property.property_rating || 0,
        reviews: property.property_reviews || 0,
        featured: Boolean(listing.featured),
        propertyType: derivePropertyType(name),
        guests: deriveGuests(property),
        petFriendly: derivePetFriendly(property),
        image: images?.[0] || LOGO_URL,
        property,
      };
    });

    return merged.filter((item) => item.price > 0 && item.image);
  }, [safeListings, safeProperties]);

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
    const propertyName = property.property_name || property.id;
    if (!propertyName) return;

    const slug = String(propertyName).toLowerCase().replace(/\s+/g, "-");

    trackEvent(
      "listing_selected",
      { surface: "apartments", listingName: propertyName },
      { listingId: property.id, unitCode: property.id, route: `/property_details/${slug}` },
    );

    navigate(`/property_details/${slug}`, {
      state: { property },
    });
  };

  React.useEffect(() => {
    trackEvent(
      "listings_browse",
      {
        surface: "apartments",
        total: filteredListings.length,
        sortBy,
        guests,
        minPrice,
        maxPrice,
        propertyType,
        petFriendlyOnly,
      },
      { route: "/apartments" },
    );
  }, [filteredListings.length, sortBy, guests, minPrice, maxPrice, propertyType, petFriendlyOnly]);

  return (
    <main className="bg-bg-muted py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 md:px-8">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Atlas Homestays</p>
          <h1 className="text-3xl font-bold text-text-primary sm:text-4xl">Hyderabad serviced apartments</h1>
          <p className="max-w-3xl text-base text-text-muted">
            Discover beautifully furnished homes tailored for extended stays, business travel, and weekend getaways.
            Browse our curated apartments and penthouses, complete with clear pricing and trusted ratings.
          </p>
        </header>

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
              image={listing.image}
              price={listing.price}
              rating={listing.rating}
              reviews={listing.reviews}
              propertyType={listing.propertyType}
              guests={listing.guests}
              petFriendly={listing.petFriendly}
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
      </div>
    </main>
  );
};

export default Apartments;
