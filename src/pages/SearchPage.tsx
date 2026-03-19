import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { propertyData } from "../data";
import { formatCurrency, parseDate } from "../utils/formatting";
import { buildHomeUnitPath, getPropertySlug } from "../utils/navigation";

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const checkIn = parseDate(searchParams.get("checkIn"));
  const checkOut = parseDate(searchParams.get("checkOut"));
  const guests = Number(searchParams.get("guests")) || null;

  const hasInvalidDates = Boolean(checkIn && checkOut && checkOut <= checkIn);

  const listings = useMemo(
    () =>
      propertyData
        .map((property) => {
          const listingId = property.listingId ?? property.id;
          const id = typeof listingId === "number" ? listingId : Number(listingId);
          if (!Number.isFinite(id) || id <= 0) return null;
          const propertySlug = getPropertySlug(property);
          const canonicalPath = buildHomeUnitPath(propertySlug, id);

          return {
            id: `${propertySlug}-${id}`,
            title: property.property_name,
            location: property.property_location ?? "Hyderabad",
            pricePerNight: property.property_price ?? 0,
            maxGuests: property.maxCapacity ?? 4,
            imageUrl: property.property_img?.[0] ?? "/hero_images/slider_bg.png",
            amenities: property.property_amenities?.slice(0, 3) ?? [],
            canonicalPath,
            property,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null),
    [],  );

  const filteredUnits = useMemo(() => {
    if (hasInvalidDates) return [];

    return listings.filter((unit) => {
      const matchesGuests = !guests || guests <= unit.maxGuests;
      return matchesGuests;
    });
  }, [guests, hasInvalidDates, listings]);

  const showEmptyState = !hasInvalidDates && filteredUnits.length === 0;  const queryString = searchParams.toString();

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

        {!showEmptyState && !hasInvalidDates && (
          <section className="grid gap-6 sm:grid-cols-2" data-testid="guest-search-results">
            {filteredUnits.map((unit) => (
              <article
                key={unit.id}
                data-testid="guest-listing-card"
                className="flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="h-48 w-full bg-gradient-to-br from-bg-muted to-bg-surface">
                  <img src={unit.imageUrl} alt={unit.title ?? "Property listing"} className="h-full w-full object-cover" loading="lazy" />                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-text-primary">{unit.title}</h2>
                      <p className="text-sm text-text-muted">Sleeps up to {unit.maxGuests} guests</p>
                    </div>
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--cta-secondary)_14%,transparent)] px-3 py-1 text-xs font-semibold text-cta-secondary">
                      {unit.location}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-text-primary" data-testid="guest-listing-nightly-price">{formatCurrency(unit.pricePerNight)}</p>
                      <p className="text-sm text-text-muted">per night</p>
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
                      state={{ property: unit.property }}
                      className="inline-flex items-center justify-center rounded-xl bg-cta-primary px-4 py-2 text-sm font-semibold text-[var(--text-contrast)] shadow hover:bg-cta-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"                    >
                      View details
                    </Link>
                  </div>
                </div>
              </article>
            ))}
