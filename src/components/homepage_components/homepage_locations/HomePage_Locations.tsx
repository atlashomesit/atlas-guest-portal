import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import Heading from "../../commonComponents/heading/Heading";
import { type Listing } from "../../../data/listings";
import { LOGO_URL } from "../../../config/branding";
import priceDisplayConfig from "../../../config/priceDisplay.config";
import { calculateNightlyPrice, inferUnitType } from "../../../utils/pricing";
import { sanitizeItems, getItemKey } from "../../../utils/sanitizeItems";
import { trackEvent } from "../../../utils/analytics";
import { buildHomeUnitPath, getPropertySlug } from "../../../utils/navigation";
import OptimizedImage from "../../ui/OptimizedImage";
import { useDailyPricingSummary } from "../../../hooks/useDailyPricingSummary";
import { useListingPhotosFromApi } from "../../../contexts/ListingPhotosContext";
import { useTenantListings, type TenantPropertyRecord } from "../../../hooks/useTenantListings";
import { filterGuestImageUrls, sanitizeGuestImageUrl } from "../../../utils/guestImageUrl";
import { compareAtlasHomesBuildingOrder } from "../../../utils/atlasHomesBuildingOrder";
import { getTenantContext } from "../../../tenant/tenantContext";
import { getTenantBrandName } from "../../../tenant/displayBrand";
import { getTenantOverrides, getUnitNoun, shouldHideAtlasBranding, type TenantOverrides } from "../../../tenant/tenantOverrides";
import { useCurrency } from "../../../contexts/CurrencyContext";
import { getListingDisplayName } from "../../../lib/listingDisplayName";

import "./homepage_location.css";

type HomePageLocationsProps = {
  listings?: unknown;
};

type PropertyRecord = TenantPropertyRecord;

type ListingModel = {
  listing: Listing;
  property?: PropertyRecord;
  images: string[];
  price?: ReturnType<typeof calculateNightlyPrice>;
};

const formatAmenityName = (value?: string) =>
  (value ?? "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

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
  getUrlsForListingId: (listingId: number | undefined) => string[] | undefined,
  tenantOverrides: TenantOverrides,
): ListingModel => {
  const property = propertyLookup[listing.id];
  const listingDbId = property?.listingId != null ? Number(property.listingId) : undefined;
  const apiUrls = getUrlsForListingId(Number.isFinite(listingDbId) ? listingDbId : undefined);
  const fromTenant = property?.property_img?.filter((u) => typeof u === "string" && u.trim()) ?? [];
  const raw =
    (apiUrls && apiUrls.length > 0 ? apiUrls : undefined) ??
    (fromTenant.length > 0 ? fromTenant : undefined) ??
    [];
  const filtered = filterGuestImageUrls(Array.isArray(raw) ? raw : []);
  const images =
    filtered.length > 0
      ? filtered
      : tenantOverrides.hideLogo
        ? [""]
        : [sanitizeGuestImageUrl(LOGO_URL) ?? ""].filter(Boolean);

  let price: ListingModel["price"];

  try {
    price = calculateNightlyPrice({
      unitType: inferUnitType(
        property ?? { id: listing.id, name: listing.title, unitType: listing.unitType }
      ),
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
  const tenant = getTenantContext();
  const tenantOverrides = getTenantOverrides(tenant?.slug);
  const hideAtlasBranding = shouldHideAtlasBranding(tenant, tenantOverrides);
  const unitNoun = getUnitNoun(tenantOverrides);
  const { format: formatCurrency } = useCurrency();
  const { checkIn, checkOut, guests, searchString } = useSearchSelections(location.search);
  const [activeImageIndex, setActiveImageIndex] = React.useState<Record<string, number>>({});
  const { loading: dailyPricingLoading, getListingPricing } = useDailyPricingSummary();
  const { getUrlsForListingId } = useListingPhotosFromApi();
  const { listings: tenantListings, properties: tenantProperties } = useTenantListings();

  const getListingNavigation = React.useCallback(
    (model: ListingModel | null) => {
      if (!model) return null;

      const listingId = model.property?.listingId ?? model.listing.id;
      const id = typeof listingId === "number" ? listingId : Number(listingId);
      if (!Number.isFinite(id) || id <= 0) return null;

      const propertyName = model.property?.property_name ?? model.listing.title;
      const propertySlug = getPropertySlug(model.property ?? { property_name: propertyName });
      const path = buildHomeUnitPath(propertySlug, id);

      return { path, propertySlug, listingId: id };
    },
    [],
  );

  const propertyLookup = React.useMemo(
    () =>
      tenantProperties.reduce<Record<string, PropertyRecord>>((acc, property) => {
        acc[String(property.id)] = property;
        return acc;
      }, {}),
    [tenantProperties],
  );

  const safeListings = React.useMemo(
    () => sanitizeItems<Listing>(listings ?? tenantListings),
    [listings, tenantListings],
  );

  const sortedListings = React.useMemo(() => {
    return [...safeListings].sort((a, b) => {
      const byFeatured = Number(b.featured) - Number(a.featured);
      if (byFeatured !== 0) return byFeatured;
      return compareAtlasHomesBuildingOrder(a.id, b.id);
    });
  }, [safeListings]);

  /* Home v2: hero+sidebar layout removed — all listings rendered in uniform grid below */

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
      const navigation = getListingNavigation(model);
      if (!navigation) return;
      const nextSearch = searchString ? `?${searchString}` : "";

      trackEvent(
        "listing_selected",
        {
          surface: "home_locations",
          listingName: model.property?.property_name ?? model.listing.title,
          checkIn,
          checkOut,
          guests,
        },
        {
          listingId: navigation.listingId,
          route: `${navigation.path}${nextSearch}`,
        },
      );

      navigate(
        { pathname: navigation.path, search: nextSearch },
        { state: { property: model.property ?? undefined, galleryImages: model.images } },
      );
    },
    [checkIn, checkOut, getListingNavigation, guests, navigate, searchString],
  );

  const _handleSlideChange = (id: string, direction: "next" | "prev", imagesLength: number) => {
    setActiveImageIndex((prev) => {
      const current = prev[id] ?? 0;
      const nextIndex = direction === "next" ? current + 1 : current - 1;
      const normalized = (nextIndex + imagesLength) % imagesLength;
      return { ...prev, [id]: normalized };
    });
  };

  const renderPrice = (model: ListingModel) => {
    if (!model.price) return null;

    const { baseNightlyPrice, finalNightlyPrice, appliedDiscountPercent, hasSpecialDateMultiplier, dateKey } =
      model.price;

    // TASK-1687: respect the user's selected display currency from CurrencyContext
    // (was hardcoded to INR via local Intl.NumberFormat).
    const formattedBase = formatCurrency(baseNightlyPrice);
    const formattedFinal = formatCurrency(finalNightlyPrice);
    const specialLabel = priceDisplayConfig.specialPricingLabels[dateKey];
    const apiListingId = model.property?.listingId ?? model.listing.id;
    const todayBreakdown = getListingPricing(apiListingId);
    const showLimitedTimeDeal =
      (model.property?.losDiscountPercent ?? 0) > 0 ||
      (model.property?.losDiscount2Percent ?? 0) > 0 ||
      (model.property?.lastMinuteDiscountPercent ?? 0) > 0;

    return (
      <div className="flex flex-col gap-1">
        {showLimitedTimeDeal ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-muted">{priceDisplayConfig.discount.secondaryBadgeLabel}</span>
          </div>
        ) : null}
        {dailyPricingLoading && (
          <span className="text-sm text-text-muted">Loading price…</span>
        )}
        {!dailyPricingLoading && todayBreakdown ? (
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-bold text-black">{formatCurrency(todayBreakdown.actualPrice)}</span>
          </div>
        ) : !dailyPricingLoading && (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-black">{formattedFinal}</span>
            {appliedDiscountPercent > 0 && (
              <>
                <span className="text-sm text-text-muted line-through">{formattedBase}</span>
                <span className="text-sm font-semibold text-[color:var(--cta-primary)]">
                  {priceDisplayConfig.discount.savingsPrefix} {appliedDiscountPercent}%
                </span>
              </>
            )}
          </div>
        )}
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

  /* Home v2: uniform 3-col grid across all listings — no split hero card */
  const allListingModels = React.useMemo(
    () =>
      sortedListings.map((item) =>
        createListingModel(item, propertyLookup, checkIn, guests, getUrlsForListingId, tenantOverrides),
      ),
    [checkIn, guests, sortedListings, propertyLookup, getUrlsForListingId, tenantOverrides],
  );

  if (allListingModels.length === 0) {
    return null;
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-bg-surface scroll-mt-28" id="our-homes">
      <div className="max-w-7xl mx-auto flex flex-col gap-10">
        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <Heading title={`Our ${unitNoun.capitalPlural}`} id="our-homes" />
          </div>
          <p className="text-sm text-text-muted max-w-xs sm:text-right leading-relaxed">
            {sortedListings.length} owner-run {sortedListings.length === 1 ? unitNoun.singular : unitNoun.plural} in KPHB, Kukatpally. Same hands clean them, restock them, and answer the door.
          </p>
        </div>

        {/* Uniform 3-col grid — Home v2 design */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {allListingModels.map((model, index) => {
            const navigation = getListingNavigation(model);
            const activeIndex = activeImageIndex[model.listing.id] ?? 0;
            const imageSrc = model.images[activeIndex] ?? "";

            return (
              <article
                key={getItemKey(model.listing, index)}
                className="property-card rounded-2xl shadow-sm bg-white overflow-hidden border border-border-subtle flex flex-col transition-transform transition-shadow duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                {/* Photo */}
                <div className="relative" style={{ aspectRatio: '4 / 3' }}>
                  <OptimizedImage
                    key={`${model.listing.id}-${activeIndex}`}
                    src={imageSrc}
                    alt={model.listing.title}
                    className="w-full h-full object-cover"
                    wrapperClassName="h-full"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    loading={index < 3 ? "eager" : undefined}
                    fetchPriority={index === 0 ? "high" : undefined}
                  />
                  {model.images.length > 1 && (
                    <div className="absolute bottom-2 left-0 right-0">
                      <div className="flex justify-center gap-1.5">
                        {model.images.slice(0, Math.min(model.images.length, 5)).map((_, dotIdx) => (
                          <button
                            key={dotIdx}
                            type="button"
                            aria-label={`Go to image ${dotIdx + 1}`}
                            onClick={() => setActiveImageIndex(prev => ({ ...prev, [model.listing.id]: dotIdx }))}
                            className={`w-2 h-2 rounded-full transition-all ${activeIndex === dotIdx ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/70'}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div>
                    {!hideAtlasBranding && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{getTenantBrandName()}</p>
                    )}
                    <h3
                      className="text-xl font-semibold text-text-primary mt-0.5"
                      style={{ fontFamily: 'var(--font-family-display)', letterSpacing: '-0.005em' }}
                    >
                      {getListingDisplayName(model.listing.id, model.listing.title)}
                    </h3>
                    {model.listing.subtitle ? (
                      <p className="text-sm text-text-muted mt-1 line-clamp-2">{model.listing.subtitle}</p>
                    ) : (
                      /* TODO: per-listing copy — wire to property_description when available */
                      model.property?.property_description ? (
                        <p className="text-sm text-text-muted mt-1 line-clamp-2">{model.property.property_description}</p>
                      ) : null
                    )}
                  </div>

                  {/* Bed / bath / sleeps row */}
                  <div className="flex items-center gap-4 text-[13.5px] text-text-muted flex-wrap">
                    {model.listing.maxGuests ? (
                      <span className="inline-flex items-center gap-1.5">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        Sleeps {model.listing.maxGuests}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1.5">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      KPHB 7th Phase
                    </span>
                  </div>

                  {renderPrice(model)}

                  {renderAmenities(model.property)}

                  {/* Single ghost "View home" CTA — no Book now on cards (Home v2) */}
                  <div className="mt-auto pt-4 border-t border-border-subtle">
                    <Link
                      to={{ pathname: navigation?.path ?? "#", search: searchString ? `?${searchString}` : "" }}
                      onClick={(event) => {
                        event.preventDefault();
                        handleNavigate(model);
                      }}
                      className="property-card__button w-full inline-flex items-center justify-center rounded-full border border-border-subtle px-5 py-2.5 text-sm font-semibold text-text-primary transition hover:border-[color:var(--cta-primary)] hover:text-[color:var(--cta-primary)] hover:bg-[color:color-mix(in_srgb,var(--cta-primary)_6%,transparent)]"
                    >
                      {`View ${unitNoun.singular}`}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HomePage_Locations;
