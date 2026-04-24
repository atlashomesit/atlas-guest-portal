import { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { propertyData } from "../data";
import { fetchPublicListings, type PublicListing } from "../api/listingClient";
import { formatCurrency, parseDate } from "../utils/formatting";
import { buildHomeUnitPath, getPropertySlug } from "../utils/navigation";
import SkeletonCard from "../components/apartments/SkeletonCard";
import OptimizedImage from "../components/ui/OptimizedImage";
import { filterGuestImageUrls, sanitizeGuestImageUrl } from "../utils/guestImageUrl";
import { compareAtlasHomesBuildingOrder } from "../utils/atlasHomesBuildingOrder";

const ITEMS_PER_PAGE = 12;

type NormalizedListing = {
  id: string;
  numericId: number;
  title: string;
  location: string;
  pricePerNight: number;
  maxGuests: number;
  imageUrl: string;
  amenities: { amenities_icon?: string }[];
  canonicalPath: string;
  property?: unknown;
  rating?: number;
};

function buildStaticListings(): NormalizedListing[] {
  return [...propertyData]
    .sort((a, b) => compareAtlasHomesBuildingOrder(a.id, b.id))
    .map((property) => {
      const listingId = property.listingId ?? property.id;
      const id = typeof listingId === "number" ? listingId : Number(listingId);
      if (!Number.isFinite(id) || id <= 0) return null;
      const propertySlug = getPropertySlug(property);
      const canonicalPath = buildHomeUnitPath(propertySlug, id);

      return {
        id: `${propertySlug}-${id}`,
        numericId: id,
        title: property.property_name,
        location: property.property_location ?? "Hyderabad",
        pricePerNight: property.property_price ?? 0,
        maxGuests: property.maxCapacity ?? 4,
        imageUrl: sanitizeGuestImageUrl(property.property_img?.[0]) ?? "",
        amenities: property.property_amenities?.slice(0, 3) ?? [],
        canonicalPath,
        property,
        rating: property.property_rating ?? undefined,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);
}

function apiToNormalized(listings: PublicListing[]): NormalizedListing[] {
  return [...listings]
    .sort((a, b) => {
      const fa = a.floor ?? 0;
      const fb = b.floor ?? 0;
      if (fb !== fa) return fb - fa;
      return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true });
    })
    .map((l) => {
      const propertySlug = getPropertySlug({ name: l.propertyName || l.name });
      const canonicalPath = buildHomeUnitPath(propertySlug, l.id);

      return {
        id: `api-${l.id}`,
        numericId: l.id,
        title: l.name || l.propertyName,
        location: l.propertyAddress ?? "Hyderabad",
        pricePerNight: l.baseNightlyRate ?? 0,
        maxGuests: l.maxGuests,
        imageUrl:
          filterGuestImageUrls(l.photoUrls ?? [])[0] ?? sanitizeGuestImageUrl(l.coverPhotoUrl) ?? "",
        amenities: [],
        canonicalPath,
        rating: l.propertyRating ?? undefined,
      };
    })
    .filter((l) => l.numericId > 0);
}

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(true);
  const [apiListings, setApiListings] = useState<NormalizedListing[] | null>(null);

  const loadFromApi = useCallback(async (signal: AbortSignal) => {
    try {
      const data = await fetchPublicListings(signal);
      if (data.length > 0) {
        setApiListings(apiToNormalized(data));
      }
    } catch {
      // API failed — static fallback is used automatically
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);

    loadFromApi(controller.signal).finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [loadFromApi]);

  const checkIn = parseDate(searchParams.get("checkIn"));
  const checkOut = parseDate(searchParams.get("checkOut"));
  const guests = Number(searchParams.get("guests")) || null;
  const minPrice = Number(searchParams.get("minPrice")) || null;
  const maxPrice = Number(searchParams.get("maxPrice")) || null;
  const remoteWork = searchParams.get("remoteWork") === "true";
  const amenitiesParam = searchParams.get("amenities") || "";
  const selectedAmenities = amenitiesParam ? amenitiesParam.split(",") : [];

  const hasInvalidDates = Boolean(checkIn && checkOut && checkOut <= checkIn);
  const hasActiveFilters = Boolean(minPrice || maxPrice || remoteWork || selectedAmenities.length > 0);

  const listings = useMemo(
    () => apiListings ?? buildStaticListings(),
    [apiListings],
  );

  const hasAmenity = (unit: NormalizedListing, amenity: string): boolean => {
    const amenityIcons = (unit.amenities || []).map(a => (a.amenities_icon || "").toLowerCase());
    const amenityMap: Record<string, string[]> = {
      ac: ["ac", "air conditioning", "air-conditioner"],
      parking: ["parking", "garage"],
      pool: ["pool", "swimming"],
      wifi: ["wifi", "internet"],
    };
    const targets = amenityMap[amenity.toLowerCase()] || [];
    return targets.some(target => amenityIcons.some(icon => icon.includes(target)));
  };

  const filteredUnits = useMemo(() => {
    if (hasInvalidDates) return [];

    return listings.filter((unit) => {
      if (guests && guests > unit.maxGuests) return false;
      if (minPrice && unit.pricePerNight > 0 && unit.pricePerNight < minPrice) return false;
      if (maxPrice && unit.pricePerNight > maxPrice) return false;
      // TASK-577: Filter by remote work friendliness (co-working desk or WiFi >= 25 Mbps)
      if (remoteWork) {
        const isRemoteWorkFriendly = (unit as any).hasCoworkingDesk || ((unit as any).wifiSpeedMbps ?? 0) >= 25;
        if (!isRemoteWorkFriendly) return false;
      }
      // Filter by selected amenities
      if (selectedAmenities.length > 0) {
        const hasAllSelectedAmenities = selectedAmenities.every(amenity => hasAmenity(unit, amenity));
        if (!hasAllSelectedAmenities) return false;
      }
      return true;
    });
  }, [guests, hasInvalidDates, listings, minPrice, maxPrice, remoteWork, selectedAmenities]);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [guests, hasInvalidDates, minPrice, maxPrice, remoteWork, selectedAmenities]);

  const updateParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  };

  const toggleAmenity = (amenity: string) => {
    const newAmenities = selectedAmenities.includes(amenity)
      ? selectedAmenities.filter(a => a !== amenity)
      : [...selectedAmenities, amenity];
    updateParam("amenities", newAmenities.join(","));
  };

  const clearFilters = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("minPrice");
      next.delete("maxPrice");
      next.delete("amenities");
      return next;
    }, { replace: true });
  };

  const visibleUnits = filteredUnits.slice(0, visibleCount);
  const hasMore = visibleCount < filteredUnits.length;
  const showEmptyState = !isLoading && !hasInvalidDates && filteredUnits.length === 0;
  const queryString = searchParams.toString();

  return (
    <main className="min-h-screen bg-bg-muted py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 md:px-8">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">Search results</p>
          <h1 className="text-3xl font-bold text-text-primary sm:text-4xl">Available apartments</h1>
          <p className="max-w-3xl text-base text-text-muted">
            Browse apartments using the filters from the homepage hero. Results are based on your dates and guest count when
            provided.
          </p>
        </header>

        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border-subtle bg-bg-surface px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted" htmlFor="filter-min-price">Min price / night</label>
            <input
              id="filter-min-price"
              type="number"
              min={0}
              placeholder="₹ Any"
              value={minPrice ?? ""}
              onChange={(e) => updateParam("minPrice", e.target.value)}
              className="w-32 rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-cta-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted" htmlFor="filter-max-price">Max price / night</label>
            <input
              id="filter-max-price"
              type="number"
              min={0}
              placeholder="₹ Any"
              value={maxPrice ?? ""}
              onChange={(e) => updateParam("maxPrice", e.target.value)}
              className="w-32 rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-cta-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted" htmlFor="filter-guests">Guests</label>
            <input
              id="filter-guests"
              type="number"
              min={1}
              max={16}
              placeholder="Any"
              value={guests ?? ""}
              onChange={(e) => updateParam("guests", e.target.value)}
              className="w-24 rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-cta-primary"
            />
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-sm">
            <input
              type="checkbox"
              id="filter-remote-work"
              checked={remoteWork}
              onChange={(e) => updateParam("remoteWork", e.target.checked ? "true" : "")}
              className="cursor-pointer"
            />
            <span className="text-text-primary">Remote work friendly</span>
          </label>
          <div className="ml-auto flex items-end gap-3">
            {!isLoading && (
              <span className="text-sm text-text-muted">{filteredUnits.length} {filteredUnits.length === 1 ? "property" : "properties"} found</span>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-border-subtle px-3 py-3 text-xs font-medium text-text-muted hover:bg-bg-muted focus:outline-none"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Amenity filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Amenities:</span>
          {["AC", "Parking", "Pool", "WiFi"].map((amenity) => (
            <button
              key={amenity}
              onClick={() => toggleAmenity(amenity)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-11 ${
                selectedAmenities.includes(amenity)
                  ? "bg-cta-primary text-white border border-cta-primary"
                  : "bg-bg-surface border border-border-subtle text-text-primary hover:border-cta-primary"
              } focus:outline-none focus:ring-2 focus:ring-cta-primary focus:ring-offset-2`}
            >
              {amenity}
            </button>
          ))}
        </div>

        {!isLoading && apiListings === null && listings.length > 0 && (
          <div className="rounded-xl border border-support-warning/40 bg-support-warning/10 px-4 py-3 text-support-warning">
            Limited results — showing cached data. Search may be temporarily unavailable.
          </div>
        )}

        {hasInvalidDates && (
          <div className="rounded-xl border border-support-error/40 bg-support-error/10 px-4 py-3 text-support-error">
            Check-out date must be after check-in. Please update your search to continue.
          </div>
        )}

        {showEmptyState && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-text-primary">No apartments match these filters</p>
            <p className="mt-2 text-text-muted">
              Try adjusting your dates or guest count, or browse all apartments to see everything that&apos;s available.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                to="/search"
                className="inline-flex items-center justify-center rounded-xl bg-cta-primary px-5 py-3 text-sm font-semibold text-[var(--text-contrast)] shadow hover:bg-cta-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
              >
                Browse all apartments
              </Link>
            </div>
          </div>
        )}

        {isLoading && (
          <section
            className="grid gap-6 sm:grid-cols-2"
            data-testid="search-skeleton"
            aria-busy="true"
            aria-label="Loading search results"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </section>
        )}

        {!isLoading && !showEmptyState && !hasInvalidDates && (
          <section
            className="grid gap-6 sm:grid-cols-2"
            data-testid="guest-search-results"
            aria-live="polite"
            aria-label={`${filteredUnits.length} apartments match your filters`}
          >
            {visibleUnits.map((unit) => (
              <article
                key={unit.id}
                data-testid="guest-listing-card"
                className="flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="h-48 w-full bg-gradient-to-br from-bg-muted to-bg-surface">
                  <OptimizedImage
                    src={unit.imageUrl}
                    alt={unit.title ?? "Property listing"}
                    className="h-full w-full object-cover"
                    wrapperClassName="h-full"
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-text-primary">{unit.title}</h2>
                      <p className="text-sm text-text-muted">Sleeps up to {unit.maxGuests} guests</p>
                      {/* TASK-577: Show WiFi speed and co-working desk badges */}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(unit as any).wifiSpeedMbps && (unit as any).wifiSpeedMbps >= 25 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                            📶 WiFi {(unit as any).wifiSpeedMbps}Mbps
                          </span>
                        )}
                        {(unit as any).hasCoworkingDesk && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                            💼 Co-working desk
                          </span>
                        )}
                      </div>
                      {unit.rating != null && unit.rating > 0 && (
                        <p className="mt-0.5 text-sm text-accent-primary font-medium">
                          {"★".repeat(Math.round(unit.rating))}<span className="text-text-muted ml-1">{unit.rating.toFixed(1)}</span>
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--cta-secondary)_14%,transparent)] px-3 py-1 text-xs font-semibold text-cta-secondary">
                      {unit.location}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-text-primary" data-testid="guest-listing-nightly-price">{formatCurrency(unit.pricePerNight)}</p>
                      <p className="text-sm text-text-muted">per night</p>
                      <p className="text-xs text-text-muted">
                        Est. total: {formatCurrency(Math.round(unit.pricePerNight * 1.12))} (incl. 12% GST)
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 text-right text-xs text-text-muted">
                      {unit.amenities.map((amenity, index) => (
                        <span key={`${unit.id}-amenity-${index}`} className="font-semibold text-text-secondary">
                          {amenity.amenities_icon}
                        </span>
                      ))}
                    </div>
                    <Link
                      to={`${unit.canonicalPath}${queryString ? `?${queryString}` : ""}`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-cta-primary px-4 py-2 text-sm font-semibold text-[var(--text-contrast)] shadow hover:bg-cta-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                    >
                      View details
                    </Link>
                  </div>
                </div>
              </article>
            ))}
            {hasMore && (
              <div className="col-span-full flex justify-center pt-4">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                  className="min-h-[44px] w-full max-w-sm rounded-xl bg-cta-primary px-6 py-3 text-base font-semibold text-[var(--text-contrast)] shadow hover:bg-cta-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary sm:w-auto"
                >
                  Load more
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
};

export default SearchPage;
