import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import Heading from "../../commonComponents/heading/Heading";
import { type Listing } from "../../../data/listings";
import { getPropertyDesignImage } from "../../../config/branding";
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
import { hasOnlinePaymentRail } from "../../../tenant/paymentRail";
import { getTenantBrandName } from "../../../tenant/displayBrand";
import { getTenantOverrides, getUnitNoun, shouldHideAtlasBranding, type TenantOverrides } from "../../../tenant/tenantOverrides";
import { useCurrency } from "../../../contexts/CurrencyContext";
import { getListingDisplayName } from "../../../lib/listingDisplayName";
import { getHomeDescriptor } from "../../../content/homeDescriptors";
import { allInTotalLabel, directPriceDisplay, directSavingsLabel } from "../../../utils/directBookingPrice";
import {
  useMarketplaceCardPrices,
  type MarketplaceCardPriceItem,
  type MarketplaceStay,
  toMarketplaceDateOnly,
  marketplaceStayNights,
} from "../../../hooks/useMarketplaceCardPrices";

import "./homepage_location.css";
import "../atlas-home-v2.css";

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

    const checkIn = parseDate(params.get("checkIn") ?? params.get("checkin"));
    const checkOut = parseDate(params.get("checkOut") ?? params.get("checkout"));
    const adults = parseGuests(params.get("adults"));
    const children = parseGuests(params.get("children"));
    const guestsParam = parseGuests(params.get("guests"));
    const guestTotal = Math.max((adults ?? 0) + (children ?? 0), guestsParam ?? 0);
    const guests = guestTotal > 0 ? guestTotal : null;

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
  const designFallback = getPropertyDesignImage(listing.id);
  const images =
    filtered.length > 0
      ? filtered
      : tenantOverrides.hideLogo
        ? [designFallback]
        : [sanitizeGuestImageUrl(designFallback) ?? designFallback].filter(Boolean);

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
  // TASK-10298998: a host with no online gateway (WhatsApp hand-off / pay at property) never charges the 3%
  // payment fee, so the card's all-in total must match the booking box, which leaves it out.
  const paymentFeeCharged = hasOnlinePaymentRail(tenant);
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

  // GUEST-034 / TASK-10299186: with dates in the search box, query the authoritative quote for those
  // dates and guests (GET /api/pricing/guest-breakdown), matching the checkout quote and SearchPage.
  // When no dates are searched, keep showing tonight's daily-summary price.
  const cardStay = React.useMemo<MarketplaceStay>(() => {
    return {
      checkIn: toMarketplaceDateOnly(checkIn),
      checkOut: toMarketplaceDateOnly(checkOut),
      guests,
    };
  }, [checkIn, checkOut, guests]);

  const hasStayDates = Boolean(
    cardStay.checkIn &&
      cardStay.checkOut &&
      marketplaceStayNights(cardStay.checkIn, cardStay.checkOut) != null,
  );

  const quoteItems = React.useMemo<MarketplaceCardPriceItem[]>(() => {
    if (!hasStayDates) return [];
    return sortedListings
      .map((listing) => {
        const property = propertyLookup[listing.id];
        const listingDbId = property?.listingId != null ? Number(property.listingId) : Number(listing.id);
        const id = Number.isFinite(listingDbId) && listingDbId > 0 ? listingDbId : Number(listing.id);
        if (!Number.isFinite(id) || id <= 0) return null;
        return {
          id,
          tenantSlug: tenant?.slug ?? "",
          chargesOnlinePaymentFee: paymentFeeCharged,
        };
      })
      .filter((item): item is MarketplaceCardPriceItem => item !== null);
  }, [hasStayDates, sortedListings, propertyLookup, tenant?.slug, paymentFeeCharged]);

  const stayPrices = useMarketplaceCardPrices(
    quoteItems,
    hasStayDates ? cardStay : { checkIn: null, checkOut: null, guests: null },
  );

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
      if (!model) return;
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

  const renderPrice = (model: ListingModel) => {
    const apiListingId = model.property?.listingId ?? model.listing.id;
    const numericListingId = Number(apiListingId);

    if (hasStayDates) {
      const stayPrice = stayPrices.get(numericListingId);
      if (stayPrice?.status === "loading") {
        return (
          <div className="ahv2-price" data-testid="home-card-price-loading">
            <span className="ahv2-price-meta">Checking price…</span>
          </div>
        );
      }
      if (stayPrice?.status === "unavailable") {
        return (
          <div className="ahv2-price" data-testid="home-card-sold-out">
            <span className="ahv2-price-amt text-rose-700">Sold out for your dates</span>
            <span className="ahv2-price-meta">Try different dates</span>
          </div>
        );
      }
      if (stayPrice?.status === "ready") {
        const { display } = stayPrice;
        return (
          <div className="ahv2-price" data-testid="home-card-price">
            <div className="ahv2-price-row">
              {display.standardNightly != null && (
                <span className="ahv2-price-strike" data-testid="home-card-standard-price">
                  <span className="sr-only">Standard price </span>
                  {formatCurrency(display.standardNightly)}
                </span>
              )}
              <span className="ahv2-price-amt" data-testid="home-card-real-price">
                {formatCurrency(display.realNightly)}
              </span>
              <span className="ahv2-price-meta">/ night</span>
            </div>
            {display.savingsPercent > 0 && (
              <span className="ahv2-price-save" data-testid="home-card-saving">
                {directSavingsLabel(display.savingsPercent)}
              </span>
            )}
            <span className="ahv2-price-meta" data-testid="home-card-total">
              {allInTotalLabel(formatCurrency(display.total), display.nights)}
            </span>
          </div>
        );
      }
    }

    if (!model.price) return null;

    const { baseNightlyPrice, finalNightlyPrice, appliedDiscountPercent, hasSpecialDateMultiplier, dateKey } =
      model.price;

    // TASK-1687: respect the user's selected display currency from CurrencyContext
    // (was hardcoded to INR via local Intl.NumberFormat).
    const formattedBase = formatCurrency(baseNightlyPrice);
    const formattedFinal = formatCurrency(finalNightlyPrice);
    const specialLabel = priceDisplayConfig.specialPricingLabels[dateKey];
    const todayBreakdown = getListingPricing(apiListingId);

    if (dailyPricingLoading) {
      return (
        <div className="ahv2-price">
          <span className="ahv2-price-meta">Loading price…</span>
        </div>
      );
    }

    // Founder ruling 2026-10-21: show tonight's real price with the direct-booking saving and the all-in total —
    // the daily-summary row is built from the checkout quote, so this is what the guest is charged.
    const display = todayBreakdown
      ? directPriceDisplay({
          baseAmount: todayBreakdown.baseAmount,
          discountAmount: todayBreakdown.baseAmount - todayBreakdown.actualPrice,
          finalAmount: todayBreakdown.finalAmount,
          nights: 1,
          paymentFeeCharged,
          paymentFeeAmount:
            (todayBreakdown.actualPrice * (todayBreakdown.convenienceFeePercent ?? 0)) / 100,
        })
      : null;

    if (display) {
      return (
        <div className="ahv2-price" data-testid="home-card-price">
          <div className="ahv2-price-row">
            {display.standardNightly != null && (
              <span className="ahv2-price-strike" data-testid="home-card-standard-price">
                <span className="sr-only">Standard price </span>
                {formatCurrency(display.standardNightly)}
              </span>
            )}
            <span className="ahv2-price-amt" data-testid="home-card-real-price">
              {formatCurrency(display.realNightly)}
            </span>
            <span className="ahv2-price-meta">/ night</span>
          </div>
          {display.savingsPercent > 0 && (
            <span className="ahv2-price-save" data-testid="home-card-saving">
              {directSavingsLabel(display.savingsPercent)}
            </span>
          )}
          <span className="ahv2-price-meta" data-testid="home-card-total">
            {allInTotalLabel(formatCurrency(display.total), display.nights)}
            {hasSpecialDateMultiplier || specialLabel
              ? ` · ${specialLabel ?? priceDisplayConfig.defaultSpecialLabel}`
              : ""}
          </span>
        </div>
      );
    }

    return (
      <div className="ahv2-price">
        <div className="ahv2-price-row">
          {todayBreakdown ? (
            <span className="ahv2-price-amt">{formatCurrency(todayBreakdown.actualPrice)}</span>
          ) : (
            <>
              <span className="ahv2-price-amt">{formattedFinal}</span>
              {appliedDiscountPercent > 0 && (
                <>
                  <span className="ahv2-price-strike">{formattedBase}</span>
                  <span className="ahv2-price-save">
                    {priceDisplayConfig.discount.savingsPrefix} {appliedDiscountPercent}%
                  </span>
                </>
              )}
            </>
          )}
        </div>
        <span className="ahv2-price-meta">
          per night · taxes included
          {hasSpecialDateMultiplier || specialLabel
            ? ` · ${specialLabel ?? priceDisplayConfig.defaultSpecialLabel}`
            : ""}
        </span>
      </div>
    );
  };

  const renderAmenities = (property?: PropertyRecord) => {
    const all = property?.property_amenities ?? [];
    if (!all.length) return null;

    // Two host-picked chips + a "+N more" pill — no spreadsheet of bullets.
    const shown = all.slice(0, 2);
    const remaining = all.length - shown.length;

    return (
      <div className="ahv2-amenities">
        {shown.map((amenity, index) => (
          <span key={`${amenity.amenities_icon}-${index}`} className="ahv2-amen-chip">
            {amenity.name?.trim() || formatAmenityName(amenity.amenities_icon)}
          </span>
        ))}
        {remaining > 0 && (
          <span className="ahv2-amen-chip ahv2-more">+{remaining} more</span>
        )}
      </div>
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
    <section
      className="py-16 px-4 sm:px-6 lg:px-8 scroll-mt-28"
      style={{ background: "var(--bg-secondary, #fdf2e9)" }}
      id="our-homes"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-10">
        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <Heading title={`Our ${unitNoun.capitalPlural}`} id="our-homes" />
          </div>
          <p className="text-sm text-text-muted max-w-xs sm:text-right leading-relaxed">
            {(() => {
              // TASK-7194: white-label uses the tenant's own city when known — never invent Hyderabad/KPHB.
              const noun =
                sortedListings.length === 1 ? unitNoun.singular : unitNoun.plural;
              const city = tenant?.legalContactPack?.city?.trim();
              if (hideAtlasBranding) {
                return `${sortedListings.length} owner-run ${noun}${city ? ` in ${city}` : ''}. Same hands clean them, restock them, and answer the door.`;
              }
              return `${sortedListings.length} owner-run ${noun} in this neighbourhood. Same hands clean them, restock them, and answer the door.`;
            })()}
          </p>
        </div>

        {/* Uniform 3-col grid — Home v2 design */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {allListingModels.map((model, index) => {
            const navigation = getListingNavigation(model);
            const photos = model.images.slice(0, Math.min(model.images.length, 5));
            const activeIndex = (activeImageIndex[model.listing.id] ?? 0) % Math.max(photos.length, 1);
            const imageSrc = photos[activeIndex] ?? model.images[0] ?? "";
            const cardTitle = getListingDisplayName(model.listing.id, model.listing.title);
            // TASK-7194: Atlas unit descriptors + KPHB fallback must not leak on white-label.
            const descriptor = hideAtlasBranding
              ? (model.listing.subtitle ??
                model.property?.property_description ??
                `A calm, owner-run ${unitNoun.singular}.`)
              : (getHomeDescriptor(model.listing.id) ??
                model.listing.subtitle ??
                model.property?.property_description ??
                "A calm, owner-run home in this neighbourhood.");

            return (
              <Link
                key={getItemKey(model.listing, index)}
                to={{ pathname: navigation?.path ?? "#", search: searchString ? `?${searchString}` : "" }}
                onClick={(event) => {
                  event.preventDefault();
                  handleNavigate(model);
                }}
                onMouseEnter={() => {
                  if (photos.length > 1) {
                    setActiveImageIndex((prev) => ({
                      ...prev,
                      [model.listing.id]: ((prev[model.listing.id] ?? 0) + 1) % photos.length,
                    }));
                  }
                }}
                className="ahv2-card property-card"
                aria-label={`See ${cardTitle}`}
              >
                {/* Photo — 4:5 portrait, dusty-rose wash, dots reveal on hover/focus */}
                <div className="ahv2-card-photo-wrap">
                  {hasStayDates &&
                    stayPrices.get(Number(model.property?.listingId ?? model.listing.id))?.status === "unavailable" && (
                      <div
                        className="absolute top-3 left-3 z-10 rounded-full bg-neutral-900/80 px-2.5 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-sm"
                        data-testid="home-card-sold-out-badge"
                      >
                        Sold Out
                      </div>
                    )}
                  <OptimizedImage
                    key={`${model.listing.id}-${activeIndex}`}
                    src={imageSrc}
                    alt={cardTitle}
                    className="ahv2-card-photo"
                    wrapperClassName="ahv2-card-photo-inner"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    loading={index < 3 ? "eager" : undefined}
                    fetchPriority={index === 0 ? "high" : undefined}
                    showSkeleton={false}
                  />
                  {photos.length > 1 && (
                    <div className="ahv2-card-dots" aria-hidden="true">
                      {photos.map((_, dotIdx) => (
                        <span
                          key={dotIdx}
                          className={`ahv2-card-dot${activeIndex === dotIdx ? " ahv2-active" : ""}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="ahv2-card-body">
                  {!hideAtlasBranding && <span className="ahv2-eyebrow">{getTenantBrandName()}</span>}
                  <h3 className="ahv2-card-title">{cardTitle}</h3>
                  <p className="ahv2-card-desc">{descriptor}</p>

                  {renderAmenities(model.property)}

                  <div className="ahv2-card-foot">
                    {renderPrice(model)}
                    <span className="ahv2-see-link">
                      {`See the ${unitNoun.singular}`}
                      <span className="ahv2-arrow" aria-hidden="true">→</span>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HomePage_Locations;
