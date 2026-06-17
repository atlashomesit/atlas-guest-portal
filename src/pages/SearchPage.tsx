import { lazy, Suspense, useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Briefcase, CalendarDays, CalendarRange, Wifi } from "lucide-react";

import { propertyData } from "../data";
import { fetchPublicListings, type PublicListing } from "../api/listingClient";
import { getListingDisplayName } from "../lib/listingDisplayName";
import { useDailyPricingSummary } from "../hooks/useDailyPricingSummary";
import { parseDate } from "../utils/formatting";
import { useCurrency } from "../contexts/CurrencyContext";
import { buildHomeUnitPath, getPropertySlug } from "../utils/navigation";
import { getTenantContext } from "../tenant/tenantContext";
import { getTenantBrandName } from "../tenant/displayBrand";
import { getTenantOverrides, getTenantPublicListingIdAllowlist, getUnitNoun, shouldHideAtlasBranding } from "../tenant/tenantOverrides";
import { LoadingState } from "../components/LoadingState";
import OptimizedImage from "../components/ui/OptimizedImage";
import OwnerShareBadge from "../components/OwnerShareBadge"; // TASK-1705
import DirectDiscountBanner from "../components/DirectDiscountBanner"; // TASK-1708
import ReviewSummary from "../components/ReviewSummary"; // TASK-1716
import LongStayCalculator from "../components/LongStayCalculator"; // TASK-1739
import { filterGuestImageUrls, sanitizeGuestImageUrl } from "../utils/guestImageUrl";
import { compareAtlasHomesBuildingOrder } from "../utils/atlasHomesBuildingOrder";
import { buildApiUrl, getApiHeaders } from "../api/client";
import { isAtlastaysMarketplaceSurface, isMarketplaceMode } from "../tenant/tenantResolver";
import AirbnbSearchBar from "../components/marketplace/airbnbSearch/AirbnbSearchBar";
import {
  fetchAvailabilitySummary,
  type ListingAvailabilitySummary,
} from "../api/availabilitySummaryClient";
import RecentlyViewedStrip from "../components/RecentlyViewedStrip";
import { fallbackCoordsForListing, hasMapCoords } from "../utils/mapCoords";
import { amenityCodeMatchesCategory, resolveAmenityLabel } from "../utils/amenityCodes";
import { estimateStayNights, formatEstTotalInclGst } from "../utils/guestPriceEstimate";
import { CONTACT } from "../config/contact";

const SearchResultsMap = lazy(() => import("../components/search/SearchResultsMap"));

const ITEMS_PER_PAGE = 12;
const MAP_MARKER_CAP = 100;

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
  /** TASK-1025/TASK-1866: Minimum stay in nights (null = no minimum / 1 night). */
  minStay?: number | null;
  /** TASK-1695: LOS auto-discount tier 1 minimum nights (null = not configured). */
  losDiscountMinNights?: number | null;
  /** TASK-1695: LOS auto-discount tier 1 percent. */
  losDiscountPercent?: number | null;
  /** TASK-1695: LOS auto-discount tier 2 minimum nights. */
  losDiscount2MinNights?: number | null;
  /** TASK-1695: LOS auto-discount tier 2 percent. */
  losDiscount2Percent?: number | null;
  /** TASK-1649: last-minute discount rule percent from API (optional). */
  lastMinuteDiscountPercent?: number | null;
  /** TASK-1725: True when Atlas team has verified photos for this listing. */
  hasVerifiedPhotos?: boolean;
  /** TASK-1727: True when the tenant has a valid GSTIN on file. */
  isGstRegistered?: boolean;
  /** TASK-1457: Map pin coordinates (API or static fallback). */
  latitude?: number | null;
  longitude?: number | null;
  /** TASK-2076: number of verified reviews — shown as (N) next to ★ rating. */
  reviewCount?: number | null;
  /** TASK-577/TASK-1738: WiFi speed in Mbps — drives the remote-work / digital-nomad filters and badge. */
  wifiSpeedMbps?: number | null;
  /** TASK-577/TASK-1738: true when the listing has a dedicated co-working desk. */
  hasCoworkingDesk?: boolean;
};

function buildStaticListings(allowedIds?: Set<number>): NormalizedListing[] {
  let filtered = propertyData;
  if (allowedIds && allowedIds.size > 0) {
    filtered = propertyData.filter(p => allowedIds.has(Number(p.id)));
  }

  return [...filtered]
    .sort((a, b) => compareAtlasHomesBuildingOrder(a.id, b.id))
    .map((property) => {
      const listingId = property.listingId ?? property.id;
      const id = typeof listingId === "number" ? listingId : Number(listingId);
      if (!Number.isFinite(id) || id <= 0) return null;
      const propertySlug = getPropertySlug(property);
      const canonicalPath = buildHomeUnitPath(propertySlug, id);
      const pin = fallbackCoordsForListing(id);

      return {
        id: `${propertySlug}-${id}`,
        numericId: id,
        title: getListingDisplayName(id, property.property_name),
        location: property.property_location ?? "Hyderabad",
        pricePerNight: property.property_price ?? 0,
        maxGuests: property.maxCapacity ?? 4,
        imageUrl: sanitizeGuestImageUrl(property.property_img?.[0]) ?? "",
        amenities: property.property_amenities?.slice(0, 3) ?? [],
        canonicalPath,
        property,
        rating: property.property_rating ?? undefined,
        reviewCount: (property as unknown as { property_reviews?: number }).property_reviews ?? null,
        latitude: pin.lat,
        longitude: pin.lng,
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
        title: getListingDisplayName(l.id, l.name || l.propertyName),
        location: l.propertyAddress ?? "Hyderabad",
        pricePerNight: l.baseNightlyRate ?? 0,
        maxGuests: l.maxGuests,
        imageUrl:
          filterGuestImageUrls(l.photoUrls ?? [])[0] ?? sanitizeGuestImageUrl(l.coverPhotoUrl) ?? "",
        // TASK-2552: use l.amenityCodes directly (now a proper field on PublicListing)
        amenities: (l.amenityCodes ?? []).map((code) => ({ amenities_icon: code })),
        canonicalPath,
        rating: l.propertyRating ?? undefined,
        reviewCount: l.reviewCount ?? null,
        // TASK-1866: map minStay so long-stay filter works on API listings
        minStay: l.minStay ?? null,
        losDiscountMinNights: l.losDiscountMinNights ?? null,
        losDiscountPercent: l.losDiscountPercent ?? null,
        losDiscount2MinNights: l.losDiscount2MinNights ?? null,
        losDiscount2Percent: l.losDiscount2Percent ?? null,
        lastMinuteDiscountPercent:
          (l as unknown as { lastMinuteDiscountPercent?: number | null }).lastMinuteDiscountPercent ?? null,
        hasVerifiedPhotos: l.photosVerifiedAt != null,
        isGstRegistered: l.isGstRegistered ?? false,
        latitude: l.latitude ?? null,
        longitude: l.longitude ?? null,
        // TASK-2552: wire nomad fields so WiFi/co-working badges and filters work on API listings
        wifiSpeedMbps: l.wifiSpeedMbps ?? null,
        hasCoworkingDesk: l.hasCoworkingDesk ?? false,
      };
    })
    .filter((l) => l.numericId > 0);
}

type MarketplaceApiItem = {
  id: number;
  tenantSlug: string;
  title: string;
  city?: string;
  pricePerNight: number;
  maxGuests: number;
  coverImageUrl?: string;
  rating?: number | null;
  reviewCount?: number | null;
};

function marketplaceToNormalized(items: MarketplaceApiItem[]): NormalizedListing[] {
  return items.map((item) => ({
    id: `mp-${item.id}`,
    numericId: item.id,
    title: item.title,
    location: item.city ?? "",
    pricePerNight: item.pricePerNight,
    maxGuests: item.maxGuests,
    imageUrl: sanitizeGuestImageUrl(item.coverImageUrl) ?? "",
    amenities: [],
    canonicalPath: `/property_details/${item.id}?tenant=${encodeURIComponent(item.tenantSlug)}`,
    rating: item.rating ?? undefined,
    reviewCount: item.reviewCount ?? null,
    latitude: null,
    longitude: null,
  }));
}

/** TASK-1460: compact label + colors for listing card availability chip. */
function availabilityChip(
  sum: ListingAvailabilitySummary | undefined,
): { label: string; className: string } | null {
  if (!sum) return null;
  if (sum.isAvailableTonight) {
    return {
      label: "Available now",
      className: "bg-emerald-100 text-emerald-800",
    };
  }
  if (sum.nextAvailableDate) {
    const d = new Date(`${sum.nextAvailableDate}T12:00:00`);
    const label = Number.isNaN(d.getTime())
      ? "Check dates"
      : `From ${d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`;
    return { label, className: "bg-sky-100 text-sky-900" };
  }
  if (sum.percentBookedNext30Days >= 75) {
    return { label: "Limited availability", className: "bg-amber-100 text-amber-900" };
  }
  return null;
}

const SearchPage = () => {
  const { format: formatDisplayCurrency, formatINR, isConverted } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMarketplaceSearch = isMarketplaceMode() && isAtlastaysMarketplaceSurface();
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(true);
  const [apiListings, setApiListings] = useState<NormalizedListing[] | null>(null);
  // TASK-1867: track real API errors separately; null apiListings on 0-listing response is not an error
  const [apiError, setApiError] = useState(false);
  const [loadingTimeoutReached, setLoadingTimeoutReached] = useState(false);

  const checkInParam = searchParams.get("checkIn");
  const checkOutParam = searchParams.get("checkOut");
  const guestsParam = searchParams.get("guests");
  const adultsParam = searchParams.get("adults");
  const childrenParam = searchParams.get("children");
  const destinationParam = searchParams.get("destination") ?? searchParams.get("city");

  const loadFromMarketplace = useCallback(async (signal: AbortSignal) => {
    setApiError(false);
    try {
      const p = new URLSearchParams();
      if (destinationParam?.trim()) p.set("city", destinationParam.trim());
      if (checkInParam) p.set("checkIn", checkInParam);
      if (checkOutParam) p.set("checkOut", checkOutParam);
      const guestTotal =
        (Number(adultsParam) || 0) + (Number(childrenParam) || 0) || Number(guestsParam) || 0;
      if (guestTotal > 0) p.set("guests", String(guestTotal));
      p.set("page", "1");
      p.set("pageSize", "100");
      const res = await fetch(buildApiUrl(`/marketplace/listings?${p.toString()}`), {
        signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("marketplace listings failed");
      const data = (await res.json()) as { items?: MarketplaceApiItem[] };
      setApiListings(marketplaceToNormalized(data.items ?? []));
    } catch {
      if (!signal.aborted) {
        setApiError(true);
        setApiListings([]);
      }
    }
  }, [adultsParam, checkInParam, checkOutParam, childrenParam, destinationParam, guestsParam]);

  const loadFromApi = useCallback(async (signal: AbortSignal) => {
    setApiError(false);
    const tenantOverrides = getTenantOverrides(getTenantContext()?.slug);
    const strictApiOnly = tenantOverrides.onlyApiListings === true;
    try {
      const data = await fetchPublicListings(signal);
      let normalized = apiToNormalized(data);
      const allow = getTenantPublicListingIdAllowlist(tenantOverrides);
      if (allow.size > 0) {
        normalized = normalized.filter((u) => allow.has(u.numericId));
      }
      // TASK-1867: always set apiListings (even empty array) so 0-listing response doesn't look like an error
      setApiListings(normalized);
    } catch {
      setApiError(true);
      if (strictApiOnly) {
        setApiListings([]);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadingTimeoutReached(false);

    const loader = isMarketplaceSearch ? loadFromMarketplace : loadFromApi;
    loader(controller.signal).finally(() => setIsLoading(false));

    // Show cached/fallback results after 2s if API still loading
    const fallbackTimer = setTimeout(() => setLoadingTimeoutReached(true), 2000);

    return () => {
      controller.abort();
      clearTimeout(fallbackTimer);
    };
  }, [isMarketplaceSearch, loadFromApi, loadFromMarketplace]);

  const minPriceParam = searchParams.get("minPrice");
  const maxPriceParam = searchParams.get("maxPrice");
  const remoteWorkParam = searchParams.get("remoteWork");
  const longStayParam = searchParams.get("longStay");
  const availableNowParam = searchParams.get("availableNow");
  const amenitiesParamRaw = searchParams.get("amenities");
  const sortByParam = searchParams.get("sortBy");
  const nomadWifiParam = searchParams.get("nomadWifi");
  const nomadWorkspaceParam = searchParams.get("nomadWorkspace");
  const monthlyStayParam = searchParams.get("monthlyStay");
  const viewParam = searchParams.get("view");

  const checkIn = useMemo(() => parseDate(checkInParam), [checkInParam]);
  const checkOut = useMemo(() => parseDate(checkOutParam), [checkOutParam]);
  const guests = useMemo(() => {
    if (adultsParam || childrenParam) {
      const total = (Number(adultsParam) || 0) + (Number(childrenParam) || 0);
      return total > 0 ? total : null;
    }
    return Number(guestsParam) || null;
  }, [adultsParam, childrenParam, guestsParam]);
  const minPrice = useMemo(() => Number(minPriceParam) || null, [minPriceParam]);
  const maxPrice = useMemo(() => Number(maxPriceParam) || null, [maxPriceParam]);
  const remoteWork = useMemo(() => remoteWorkParam === "true", [remoteWorkParam]);
  const longStay = useMemo(() => longStayParam === "true", [longStayParam]);
  /** TASK-1297: filter to listings with inventory for tonight (IST). */
  const availableNow = useMemo(() => availableNowParam === "true", [availableNowParam]);
  const amenitiesParam = useMemo(() => amenitiesParamRaw || "", [amenitiesParamRaw]);
  const selectedAmenities = useMemo(() => amenitiesParam ? amenitiesParam.split(",") : [], [amenitiesParam]);
  /** TASK-1714: sort order — default "recommended" (Atlas building/floor order). */
  const sortBy = useMemo(() => sortByParam || "recommended", [sortByParam]);
  /** TASK-1738: Digital nomad filter chips. */
  const nomadWifi = useMemo(() => nomadWifiParam === "true", [nomadWifiParam]);       // WiFi 50+ Mbps
  const nomadWorkspace = useMemo(() => nomadWorkspaceParam === "true", [nomadWorkspaceParam]); // dedicated workspace
  const monthlyStay = useMemo(() => monthlyStayParam === "true", [monthlyStayParam]);   // 30+ nights min stay
  /** TASK-1457: list vs map layout for search results. */
  const mapView = useMemo(() => viewParam === "map", [viewParam]);

  const hasInvalidDates = useMemo(() => Boolean(checkIn && checkOut && checkOut <= checkIn), [checkIn, checkOut]);
  const explicitDateSearch = useMemo(() => Boolean(checkIn && checkOut), [checkIn, checkOut]);
  /** TASK-1451: include guests so "Clear filters" resets guest count too. */
  const hasActiveFilters = Boolean(
    minPrice || maxPrice || remoteWork || longStay || availableNow || selectedAmenities.length > 0
    || nomadWifi || nomadWorkspace || monthlyStay || guests != null
    || sortBy !== "recommended" || mapView,
  );

  const [tonightAvailableIds, setTonightAvailableIds] = useState<Set<number> | null>(null);
  const [tonightProbeLoading, setTonightProbeLoading] = useState(false);
  // TASK-1865 / TASK-1648: batch (or public availability) check for checkIn+checkOut dates + per-date-pair cache
  const [dateAvailableIds, setDateAvailableIds] = useState<Set<number> | null>(null);
  const [dateAvailLoading, setDateAvailLoading] = useState(false);
  const dateAvailCacheRef = useRef<Map<string, Set<number>>>(new Map());
  /** TASK-1460: batch availability hints for cards when guest has not set explicit date search. */
  const [availabilityById, setAvailabilityById] = useState<Record<number, ListingAvailabilitySummary>>({});
  const [availabilityFetchDone, setAvailabilityFetchDone] = useState(false);

  const tenant = getTenantContext();
  const brandName = getTenantBrandName();
  const overrides = getTenantOverrides(tenant?.slug);
  const hideAtlasBranding = shouldHideAtlasBranding(tenant, overrides);
  const unitNoun = getUnitNoun(overrides);
  // P0#3: use API-driven daily price (same source as Home page) so prices are consistent.
  const { getListingPricing: getDailyListingPricing } = useDailyPricingSummary();
  const tenantAllowedIds = useMemo(() => {
    const allowed = getTenantPublicListingIdAllowlist(overrides);
    return allowed.size > 0 ? allowed : undefined;
  }, [overrides]);

  const onlyApiListings = overrides.onlyApiListings === true;
  const estimateNights = useMemo(() => estimateStayNights(checkIn, checkOut), [checkIn, checkOut]);
  const listings = useMemo(() => {
    if (isMarketplaceSearch) {
      return apiListings !== null ? apiListings : [];
    }
    if (onlyApiListings) {
      return apiListings !== null ? apiListings : [];
    }
    if (apiListings !== null) {
      return apiListings;
    }
    // TASK-2904: never swap static homes in while the live API request is in flight
    if (isLoading) {
      return [];
    }
    return buildStaticListings(tenantAllowedIds);
  }, [apiListings, isMarketplaceSearch, tenantAllowedIds, onlyApiListings, isLoading]);
  const showingSampleListings =
    !onlyApiListings && apiListings === null && !isLoading && listings.length > 0;

  useEffect(() => {
    if (!availableNow) {
      setTonightAvailableIds(null);
      setTonightProbeLoading(false);
      return;
    }

    const controller = new AbortController();
    const ids = [...new Set(listings.map((u) => u.numericId))].filter((id) => id > 0).slice(0, 40);
    if (ids.length === 0) {
      setTonightAvailableIds(new Set());
      setTonightProbeLoading(false);
      return;
    }

    setTonightProbeLoading(true);
    setTonightAvailableIds(null);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

    const probeOne = async (id: number): Promise<boolean> => {
      try {
        const url = buildApiUrl(
          `/availability/listing-availability?listingId=${id}&startDate=${encodeURIComponent(today)}&months=1`,
        );
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json", ...getApiHeaders() },
        });
        if (!res.ok) return true;
        const j = (await res.json()) as {
          availability?: { date?: string; Date?: string; status?: string; Status?: string; inventory?: number; Inventory?: number }[];
          Availability?: { date?: string; Date?: string; status?: string; Status?: string; inventory?: number; Inventory?: number }[];
        };
        const days = j.availability ?? j.Availability ?? [];
        const row = days.find((d) => (d.date ?? d.Date) === today);
        if (!row) return true;  // TASK-4107: missing today-row = inconclusive → fail-open
        const st = String(row.status ?? row.Status ?? "").toLowerCase();
        const inv = Number(row.inventory ?? row.Inventory ?? 0);
        if (st === "blocked" || st === "hold") return false;
        return inv > 0 || st === "available" || st === "turnover";
      } catch {
        return true;
      }
    };

    void (async () => {
      const ok = new Set<number>();
      const batch = 8;
      for (let i = 0; i < ids.length; i += batch) {
        if (controller.signal.aborted) return;
        const slice = ids.slice(i, i + batch);
        const flags = await Promise.all(slice.map(async (id) => ((await probeOne(id)) ? id : -1)));
        for (const x of flags) {
          if (x > 0) ok.add(x);
        }
      }
      if (!controller.signal.aborted) {
        setTonightAvailableIds(ok);
        setTonightProbeLoading(false);
      }
    })();

    return () => controller.abort();
  }, [availableNow, listings]);

  // TASK-1648: GET /api/public/listings/availability?checkIn&checkOut when present, else batch; cache by date pair; fail-open
  useEffect(() => {
    if (!checkIn || !checkOut || hasInvalidDates) {
      setDateAvailableIds(null);
      setDateAvailLoading(false);
      return;
    }
    const startStr = checkIn.toISOString().slice(0, 10);
    const endStr = checkOut.toISOString().slice(0, 10);
    const cacheKey = `${startStr}|${endStr}`;
    if (dateAvailCacheRef.current.has(cacheKey)) {
      setDateAvailableIds(new Set(dateAvailCacheRef.current.get(cacheKey)!));
      setDateAvailLoading(false);
      return;
    }

    const controller = new AbortController();
    setDateAvailLoading(true);
    setDateAvailableIds(null);

    const parseIds = (payload: unknown): number[] | undefined => {
      if (!payload || typeof payload !== "object") return undefined;
      const o = payload as Record<string, unknown>;
      const raw =
        o.listingIds ??
        o.availableListingIds ??
        o.ListingIds ??
        o.AvailableListingIds;
      if (!Array.isArray(raw)) return undefined;
      return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    };

    const headers = { Accept: "application/json", ...getApiHeaders() } as Record<string, string>;

    void (async () => {
      try {
        // Add 8-second timeout to prevent hanging availability checks
        const timeoutPromise = new Promise<undefined>((resolve) => {
          setTimeout(() => resolve(undefined), 8000);
        });

        const fetchPromise = (async () => {
          const primary = buildApiUrl(
            `/api/public/listings/availability?checkIn=${encodeURIComponent(startStr)}&checkOut=${encodeURIComponent(endStr)}`,
          );
          let listingIds: number[] | undefined;
          const resPrimary = await fetch(primary, { signal: controller.signal, headers });
          if (resPrimary.ok) {
            listingIds = parseIds(await resPrimary.json());
          } else {
            const batchUrl = buildApiUrl(
              `/api/public/listings/availability-batch?startDate=${encodeURIComponent(startStr)}&endDate=${encodeURIComponent(endStr)}`,
            );
            const resBatch = await fetch(batchUrl, { signal: controller.signal, headers });
            if (resBatch.ok) {
              const data = (await resBatch.json()) as { availableListingIds?: number[] };
              listingIds = data.availableListingIds ?? parseIds(data);
            }
          }
          return listingIds;
        })();

        const listingIds = await Promise.race([fetchPromise, timeoutPromise]);

        if (controller.signal.aborted) return;
        if (listingIds != null) {
          const next = new Set(listingIds);
          dateAvailCacheRef.current.set(cacheKey, next);
          setDateAvailableIds(next);
        } else {
          setDateAvailableIds(null);
        }
      } catch {
        if (!controller.signal.aborted) {
          setDateAvailableIds(null);
        }
      } finally {
        if (!controller.signal.aborted) setDateAvailLoading(false);
      }
    })();

    return () => controller.abort();
  }, [checkIn, checkOut, hasInvalidDates]);

  const hasAmenity = (unit: NormalizedListing, amenity: string): boolean => {
    const codes = (unit.amenities || []).map((a) => a.amenities_icon || "");
    return codes.some((code) => amenityCodeMatchesCategory(code, amenity));
  };

  const filteredUnits = useMemo(() => {
    if (hasInvalidDates) return [];

    return listings.filter((unit) => {
      if (isMarketplaceSearch && destinationParam?.trim()) {
        const dest = destinationParam.trim().toLowerCase();
        const haystack = `${unit.location} ${unit.title}`.toLowerCase();
        if (!haystack.includes(dest)) return false;
      }
      if (guests && guests > unit.maxGuests) return false;
      if (minPrice && unit.pricePerNight > 0 && unit.pricePerNight < minPrice) return false;
      if (maxPrice && unit.pricePerNight > maxPrice) return false;
      // TASK-1865: exclude listings confirmed unavailable for selected dates; skip when still loading or fetch failed
      if (checkIn && checkOut && !dateAvailLoading && dateAvailableIds !== null) {
        if (!dateAvailableIds.has(unit.numericId)) return false;
      }
      // TASK-577: Filter by remote work friendliness (co-working desk or WiFi >= 25 Mbps)
      if (remoteWork) {
        const isRemoteWorkFriendly = unit.hasCoworkingDesk || (unit.wifiSpeedMbps ?? 0) >= 25;
        if (!isRemoteWorkFriendly) return false;
      }
      // TASK-1025/TASK-1866: Filter by long-stay (7+ night minimum).
      // minStay is now typed on NormalizedListing; apiToNormalized maps l.minStay so API listings work.
      if (longStay) {
        const minStay = unit.minStay ?? 1;
        if (minStay < 7) return false;
      }
      // TASK-1738: Digital nomad filters.
      if (nomadWifi) {
        if ((unit.wifiSpeedMbps ?? 0) < 50) return false;
      }
      if (nomadWorkspace) {
        const hasWorkspace = hasAmenity(unit, "workspace") || unit.hasCoworkingDesk;
        if (!hasWorkspace) return false;
      }
      if (monthlyStay) {
        const minStay = unit.minStay ?? 1;
        if (minStay < 30) return false;
      }
      // Filter by selected amenities
      if (selectedAmenities.length > 0) {
        const hasAllSelectedAmenities = selectedAmenities.every(amenity => hasAmenity(unit, amenity));
        if (!hasAllSelectedAmenities) return false;
      }
      if (availableNow) {
        if (tonightProbeLoading) return true;
        if (tonightAvailableIds === null) return true;
        if (!tonightAvailableIds.has(unit.numericId)) return false;
      }
      return true;
    });
  }, [
    availableNow,
    checkIn,
    checkOut,
    dateAvailableIds,
    dateAvailLoading,
    destinationParam,
    guests,
    hasInvalidDates,
    isMarketplaceSearch,
    listings,
    longStay,
    maxPrice,
    minPrice,
    monthlyStay,
    nomadWifi,
    nomadWorkspace,
    remoteWork,
    selectedAmenities,
    tonightAvailableIds,
    tonightProbeLoading,
  ]);

  /** TASK-1714: Apply chosen sort order on top of filtered results. */
  const sortedUnits = useMemo(() => {
    const s = [...filteredUnits];
    switch (sortBy) {
      case "price_asc":   return s.sort((a, b) => a.pricePerNight - b.pricePerNight);
      case "price_desc":  return s.sort((a, b) => b.pricePerNight - a.pricePerNight);
      case "rating_desc": return s.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      case "newest":      return s.sort((a, b) => b.numericId - a.numericId);
      default:            return s; // "recommended" — preserve Atlas weighting
    }
  }, [filteredUnits, sortBy]);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [availableNow, guests, hasInvalidDates, longStay, mapView, minPrice, maxPrice, monthlyStay, nomadWifi, nomadWorkspace, remoteWork, selectedAmenities, sortBy, tonightProbeLoading]);

  useEffect(() => {
    if (isLoading || hasInvalidDates || explicitDateSearch) {
      if (explicitDateSearch || hasInvalidDates) setAvailabilityById({});
      setAvailabilityFetchDone(explicitDateSearch || hasInvalidDates);
      return;
    }
    const ids = sortedUnits.map((u) => u.numericId).filter((id) => id > 0);
    if (ids.length === 0) {
      setAvailabilityById({});
      setAvailabilityFetchDone(true);
      return;
    }
    setAvailabilityFetchDone(false);
    const c = new AbortController();
    fetchAvailabilitySummary(ids, c.signal)
      .then((rows) => {
        const next: Record<number, ListingAvailabilitySummary> = {};
        for (const r of rows) next[r.listingId] = r;
        setAvailabilityById(next);
      })
      .catch(() => setAvailabilityById({}))
      .finally(() => {
        if (!c.signal.aborted) setAvailabilityFetchDone(true);
      });
    return () => c.abort();
  }, [sortedUnits, isLoading, hasInvalidDates, explicitDateSearch]);

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
      next.delete("remoteWork");
      next.delete("longStay");
      next.delete("availableNow");
      next.delete("guests");
      // TASK-1738: clear digital nomad filters
      next.delete("nomadWifi");
      next.delete("nomadWorkspace");
      next.delete("monthlyStay");
      next.delete("sortBy");
      next.delete("view");
      return next;
    }, { replace: true });
  };

  /** TASK-1456: removable chips + count badge (one chip per logical filter). */
  const activeFilterChips = useMemo(() => {
    type Chip = { key: string; label: string; onRemove: () => void };
    const chips: Chip[] = [];
    const del = (key: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete(key);
        return next;
      }, { replace: true });
    };
    if (minPrice != null && maxPrice != null) {
      chips.push({
        key: "priceRange",
        label: `₹${minPrice.toLocaleString("en-IN")}–₹${maxPrice.toLocaleString("en-IN")}/night`,
        onRemove: () => {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("minPrice");
            next.delete("maxPrice");
            return next;
          }, { replace: true });
        },
      });
    } else {
      if (minPrice != null) {
        chips.push({
          key: "minPrice",
          label: `Min ₹${minPrice.toLocaleString("en-IN")}/night`,
          onRemove: () => del("minPrice"),
        });
      }
      if (maxPrice != null) {
        chips.push({
          key: "maxPrice",
          label: `Max ₹${maxPrice.toLocaleString("en-IN")}/night`,
          onRemove: () => del("maxPrice"),
        });
      }
    }
    if (guests != null) {
      chips.push({
        key: "guests",
        label: `${guests} guest${guests === 1 ? "" : "s"}`,
        onRemove: () => del("guests"),
      });
    }
    for (const a of selectedAmenities) {
      if (!a) continue;
      chips.push({
        key: `amenity:${a}`,
        label: a,
        onRemove: () => {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            const current = (next.get("amenities") || "").split(",").filter(Boolean);
            const rest = current.filter((x) => x !== a);
            if (rest.length) next.set("amenities", rest.join(","));
            else next.delete("amenities");
            return next;
          }, { replace: true });
        },
      });
    }
    if (remoteWork) {
      chips.push({ key: "remoteWork", label: "Remote work friendly", onRemove: () => del("remoteWork") });
    }
    if (longStay) {
      chips.push({ key: "longStay", label: "Long stay (7+ nights)", onRemove: () => del("longStay") });
    }
    if (availableNow) {
      chips.push({ key: "availableNow", label: "Available tonight", onRemove: () => del("availableNow") });
    }
    if (nomadWifi) {
      chips.push({ key: "nomadWifi", label: "WiFi 50+ Mbps", onRemove: () => del("nomadWifi") });
    }
    if (nomadWorkspace) {
      chips.push({ key: "nomadWorkspace", label: "Dedicated workspace", onRemove: () => del("nomadWorkspace") });
    }
    if (monthlyStay) {
      chips.push({ key: "monthlyStay", label: "30+ nights min stay", onRemove: () => del("monthlyStay") });
    }
    return chips;
  }, [
    availableNow,
    guests,
    longStay,
    maxPrice,
    minPrice,
    monthlyStay,
    nomadWifi,
    nomadWorkspace,
    remoteWork,
    selectedAmenities,
    setSearchParams,
  ]);

  const visibleUnits = sortedUnits.slice(0, visibleCount);
  const hasMore = visibleCount < sortedUnits.length;
  const dateAvailCheckFailed =
    explicitDateSearch && !dateAvailLoading && dateAvailableIds === null && !hasInvalidDates;
  const showTonightProbeBanner = availableNow && tonightProbeLoading;
  const showEmptyState =
    !isLoading && !hasInvalidDates && sortedUnits.length === 0 && !showTonightProbeBanner;
  /** TASK-1648: skeleton while public availability resolves for selected dates (list view). */
  const showDateAvailabilitySkeleton =
    explicitDateSearch && !hasInvalidDates && dateAvailLoading && !isLoading && !mapView;
  /** TASK-2893: dates were searched but the live availability check returned nothing (fail-open),
   * so we're showing all homes unfiltered — don't claim they're "available for your dates". */
  const dateAvailUnconfirmed =
    explicitDateSearch && !hasInvalidDates && !dateAvailLoading && dateAvailableIds === null;
  /** TASK-4070: only true once the availability fetch resolved with real data. */
  const dateAvailConfirmed =
    explicitDateSearch && !hasInvalidDates && !dateAvailLoading && dateAvailableIds !== null;
  const queryString = searchParams.toString();
  const querySuffix = queryString ? `?${queryString}` : "";
  const approximatePinHint = useMemo(
    () => apiListings != null && apiListings.some((u) => !hasMapCoords(u.latitude, u.longitude)),
    [apiListings],
  );
  const mapUnits = useMemo(
    () =>
      sortedUnits.slice(0, MAP_MARKER_CAP).map((u) => {
        const exact = hasMapCoords(u.latitude, u.longitude);
        const pin = exact
          ? { lat: u.latitude as number, lng: u.longitude as number }
          : fallbackCoordsForListing(u.numericId);
        return {
          numericId: u.numericId,
          title: u.title,
          pricePerNight: u.pricePerNight,
          canonicalPath: u.canonicalPath,
          latitude: pin.lat,
          longitude: pin.lng,
        };
      }),
    [sortedUnits],
  );
  /** TASK-1451 / TASK-2572 / TASK-4092: cheapest 3 available listings — excludes date-unavailable homes. */
  const emptyStateSuggestions = useMemo(() => {
    if (listings.length === 0) return [];
    const dateFiltered = dateAvailableIds !== null
      ? listings.filter((l) => dateAvailableIds.has(l.numericId))
      : listings;
    const pool = dateFiltered.length > 0 ? dateFiltered : listings;
    return [...pool]
      .sort((a, b) => a.pricePerNight - b.pricePerNight)
      .slice(0, 3);
  }, [listings, dateAvailableIds]);

  return (
    <div className="min-h-screen bg-bg-muted py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 md:px-8">
        {isMarketplaceSearch ? (
          <div className="sticky top-[var(--nav-height)] z-30 -mx-4 bg-bg-muted px-4 py-3 md:static md:mx-0 md:bg-transparent md:p-0">
            <AirbnbSearchBar />
          </div>
        ) : null}

        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">Search results</p>
          {/* TASK-1864: dynamic h1 — only say "homes for your dates" when dates are actually set */}
          <h1 className="text-3xl font-bold text-text-primary sm:text-4xl" data-testid="search-results-h1">
            {isMarketplaceSearch && destinationParam
              ? `Stays in ${destinationParam}`
              : checkIn && checkOut
              ? `${filteredUnits.length} ${filteredUnits.length === 1 ? "home" : "homes"}${dateAvailConfirmed ? " for your dates" : dateAvailLoading ? " — checking availability" : ""}`
              : getTenantBrandName()}
          </h1>
          <p className="max-w-3xl text-base text-text-body">
            {checkIn && checkOut && !hasInvalidDates
              ? (dateAvailUnconfirmed
                  ? "We couldn't confirm live availability for these dates, so we're showing all homes — please reconfirm with the host before booking. Refine with price, guests, and amenities below."
                  : "Homes below are filtered to those available for your dates when our live check succeeds. You can still refine with price, guests, and amenities.")
              : "Browse all homes. Filter by price, guests and amenities below."}
          </p>
        </header>

        <RecentlyViewedStrip />

        {/* TASK-1456: filter surface label + active count badge */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">Filters</span>
          {activeFilterChips.length > 0 ? (
            <span
              className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-cta-primary px-2 text-xs font-bold text-white"
              data-testid="search-active-filter-badge"
              aria-label={`${activeFilterChips.length} active filters`}
            >
              {activeFilterChips.length}
            </span>
          ) : null}
        </div>
        {activeFilterChips.length > 0 ? (
          <ul
            className="m-0 flex list-none flex-wrap gap-2 p-0"
            data-testid="search-active-filter-chips"
            aria-label="Active filters"
          >
            {activeFilterChips.map((c) => (
              <li key={c.key} className="contents">
                <button
                  type="button"
                  onClick={c.onRemove}
                  aria-label={`Remove filter ${c.label}`}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-border-subtle bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-primary shadow-sm hover:border-support-error hover:text-support-error focus:outline-none focus:ring-2 focus:ring-cta-primary"
                >
                  <span className="truncate">{c.label}</span>
                  <span className="shrink-0 text-base leading-none" aria-hidden>
                    ×
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Filter bar — TASK-2075: sticky so it stays visible after scrolling past 8+ listings */}
        <div className="sticky top-16 z-10 flex flex-wrap items-end gap-3 rounded-2xl border border-border-subtle bg-bg-surface px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-muted" htmlFor="filter-min-price">Min price / night</label>
            <input
              id="filter-min-price"
              type="number"
              min={0}
              placeholder="₹ Any"
              value={minPrice ?? ""}
              onChange={(e) => updateParam("minPrice", e.target.value)}
              className="min-h-11 w-32 rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-base text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-cta-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-muted" htmlFor="filter-max-price">Max price / night</label>
            <input
              id="filter-max-price"
              type="number"
              min={0}
              placeholder="₹ Any"
              value={maxPrice ?? ""}
              onChange={(e) => updateParam("maxPrice", e.target.value)}
              className="min-h-11 w-32 rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-base text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-cta-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-muted" htmlFor="filter-guests">Guests</label>
            <input
              id="filter-guests"
              type="number"
              min={1}
              max={16}
              placeholder="Any"
              value={guests ?? ""}
              onChange={(e) => updateParam("guests", e.target.value)}
              className="min-h-11 w-24 rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-base text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-cta-primary"
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
          <label className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-sm">
            <input
              type="checkbox"
              id="filter-long-stay"
              checked={longStay}
              onChange={(e) => updateParam("longStay", e.target.checked ? "true" : "")}
              className="cursor-pointer"
            />
            <span className="text-text-primary">Long stay (7+ nights)</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-sm">
            <input
              type="checkbox"
              id="filter-available-tonight"
              checked={availableNow}
              onChange={(e) => {
                const checked = e.target.checked;
                updateParam("availableNow", checked ? "true" : "");
                if (checked && (checkIn || checkOut)) {
                  const now = new Date();
                  const todayStr = now.toISOString().slice(0, 10);
                  const tom = new Date(now.getTime() + 86400000);
                  const tomStr = tom.toISOString().slice(0, 10);
                  updateParam("checkIn", todayStr);
                  updateParam("checkOut", tomStr);
                }
              }}
              className="cursor-pointer"
              data-testid="search-filter-available-tonight"
            />
            <span className="text-text-primary">Available tonight</span>
          </label>
          <div className="ml-auto flex items-end gap-3">
            {!isLoading && listings.length > 0 && (
              <span className="text-sm text-text-muted">
                {/* TASK-1865: show availability check status for date filter (skip during initial load) */}
                {filteredUnits.length === 0 && hasActiveFilters
                  ? "No properties match your filters"
                  : `${filteredUnits.length} ${filteredUnits.length === 1 ? "property" : "properties"} found`}
              </span>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-[48px] rounded-lg border border-border-subtle px-4 py-3 text-base font-medium text-text-muted hover:bg-bg-muted focus:outline-none"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Amenity filters — TASK-1711: 6 basic chips + 2 nomad chips = 8 total */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-medium text-text-muted uppercase tracking-wide">Amenities:</span>
          {["AC", "Parking", "Pool", "WiFi", "Pet-friendly", "Balcony"].map((amenity) => (
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

        {/* TASK-1738: Digital nomad filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-medium text-text-muted uppercase tracking-wide">Digital nomad:</span>
          {(
            [
              { param: "nomadWifi", active: nomadWifi, icon: Wifi, text: "WiFi 50+ Mbps" },
              { param: "nomadWorkspace", active: nomadWorkspace, icon: Briefcase, text: "Workspace" },
              { param: "longStay", active: longStay, icon: CalendarDays, text: "7+ nights" },
              { param: "monthlyStay", active: monthlyStay, icon: CalendarRange, text: "30+ nights" },
            ] as const
          ).map(({ param, active, icon: Icon, text }) => (
            <button
              key={param}
              type="button"
              onClick={() => updateParam(param, active ? "" : "true")}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-11 ${
                active
                  ? "bg-emerald-600 text-white border border-emerald-600"
                  : "bg-bg-surface border border-border-subtle text-text-primary hover:border-emerald-500"
              } focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2`}
              aria-pressed={active}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{text}</span>
            </button>
          ))}
        </div>

        {/* TASK-1457: list/map toggle · TASK-1714: sort */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-flex rounded-xl border border-border-subtle bg-bg-surface p-1 shadow-sm"
            role="group"
            aria-label="Result layout"
          >
            <button
              type="button"
              aria-pressed={!mapView}
              onClick={() => updateParam("view", "")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                !mapView ? "bg-cta-primary text-[var(--text-contrast)]" : "text-text-primary hover:bg-bg-muted"
              }`}
              data-testid="search-view-list"
            >
              List
            </button>
            <button
              type="button"
              aria-pressed={mapView}
              onClick={() => updateParam("view", "map")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                mapView ? "bg-cta-primary text-[var(--text-contrast)]" : "text-text-primary hover:bg-bg-muted"
              }`}
              data-testid="search-view-map"
            >
              Map
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-text-muted" htmlFor="sort-by">Sort:</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => updateParam("sortBy", e.target.value === "recommended" ? "" : e.target.value)}
              className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-cta-primary"
            >
              <option value="recommended" title={`Sorted by ${getTenantBrandName()} suggested order — building, floor, and availability`}>Recommended</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="rating_desc">Highest rated</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        {/* TASK-1708: Direct booking discount nudge — shows for direct traffic only */}
        <DirectDiscountBanner />

        {/* TASK-1648: skeleton while resolving date-based availability */}
        {explicitDateSearch && !hasInvalidDates && dateAvailLoading && !mapView && (
          <section
            className="grid gap-6 sm:grid-cols-2"
            data-testid="search-date-availability-skeleton"
            aria-busy="true"
            aria-label="Checking availability for your dates"
          >
            <div className="col-span-full py-8">
              <div className="flex flex-col items-center justify-center gap-3 text-center">
                <div className="h-8 w-8 rounded-full border-4 border-border-subtle border-t-cta-primary animate-spin" aria-hidden />
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">Checking availability</p>
                  <p className="text-sm text-text-muted">Finding homes for your dates...</p>
                </div>
              </div>
            </div>
            <LoadingState kind="skeleton-card" count={4} />
          </section>
        )}

        {/* TASK-1867: only show banner on a real fetch error, not when API returns 0 listings */}
        {showingSampleListings && (
          <div
            className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-muted/60 px-4 py-3 text-sm text-text-secondary"
            data-testid="search-sample-listings-banner"
          >
            Showing sample homes while we refresh live prices and availability…
          </div>
        )}

        {dateAvailCheckFailed && (
          <div
            className="flex items-center gap-3 rounded-xl border border-support-warning/40 bg-support-warning/10 px-4 py-3 text-support-warning"
            data-testid="search-date-availability-failed"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              We couldn&apos;t verify availability for your dates. Results may include homes that are
              already booked — please confirm with the host before paying.
            </span>
          </div>
        )}

        {showTonightProbeBanner && (
          <div
            className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-surface px-4 py-3 text-text-secondary"
            data-testid="search-tonight-probe-loading"
            aria-live="polite"
          >
            <div className="h-5 w-5 shrink-0 rounded-full border-2 border-border-subtle border-t-cta-primary animate-spin" aria-hidden />
            <span>Checking tonight&apos;s availability…</span>
          </div>
        )}

        {!isLoading && apiError && listings.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-support-warning/40 bg-support-warning/10 px-4 py-3 text-support-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              Live listing refresh failed. Showing cached results — call{" "}
              <a href={`tel:+91${CONTACT.business.phone}`} className="font-semibold underline underline-offset-2">
                +91-{CONTACT.business.phone}
              </a>{" "}
              to confirm before booking.
            </span>
          </div>
        )}

        {hasInvalidDates && (
          <div className="rounded-xl border border-support-error/40 bg-support-error/10 px-4 py-3 text-support-error">
            Check-out date must be after check-in. Please update your search to continue.
          </div>
        )}

        {showEmptyState && !mapView && (
          <div className="flex flex-col gap-8">
            <div
              className="rounded-2xl border border-border-subtle bg-bg-surface px-4 py-8 text-center shadow-sm sm:px-8"
              data-testid="search-empty-state"
            >
              {!hideAtlasBranding && (
                <div className="mx-auto mb-6 flex max-w-xs justify-center" aria-hidden>
                  {tenant?.logoUrl ? (
                    <img
                      src={tenant.logoUrl}
                      alt=""
                      className="h-20 w-auto max-w-full object-contain opacity-90"
                      loading="lazy"
                      decoding="async"
                      width={300}
                      height={80}
                    />
                  ) : (
                    <img
                      src="/images/atlas-homestays-static-map.svg"
                      alt=""
                      className="h-28 w-auto max-w-full object-contain opacity-90"
                      loading="lazy"
                      decoding="async"
                      width={300}
                      height={112}
                    />
                  )}
                </div>
              )}
              <h2 className="text-xl font-bold text-text-primary sm:text-2xl">{`No ${unitNoun.marketingPlural} match your filters`}</h2>
              <p className="mx-auto mt-3 max-w-lg text-text-muted">
                Try adjusting dates, price range, or guest count.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex min-h-[44px] w-full max-w-xs items-center justify-center rounded-xl bg-cta-primary px-5 py-3 text-sm font-semibold text-[var(--text-contrast)] shadow hover:bg-cta-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary sm:w-auto"
                    data-testid="search-empty-clear-filters"
                  >
                    Clear filters
                  </button>
                ) : null}
                <Link
                  to="/search"
                  className={`inline-flex min-h-[44px] w-full max-w-xs items-center justify-center rounded-xl border border-border-subtle px-5 py-3 text-sm font-semibold text-text-primary shadow-sm hover:bg-bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary sm:w-auto ${hasActiveFilters ? "" : "bg-cta-primary text-[var(--text-contrast)] border-transparent hover:bg-cta-secondary"}`}
                  data-testid="search-empty-browse-all"
                >
                  Browse all apartments
                </Link>
              </div>
            </div>

            {emptyStateSuggestions.length > 0 && (
              <section
                className="space-y-4"
                data-testid="search-empty-suggestions"
                aria-label="You might also like"
              >
                <h3 className="text-lg font-semibold text-text-primary">You might also like</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {emptyStateSuggestions.map((unit) => (
                    <article
                      key={`suggest-${unit.id}`}
                      className="flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-sm"
                      data-testid="search-empty-suggestion-card"
                    >
                      <div className="h-36 w-full bg-bg-muted">
                        <OptimizedImage
                          src={unit.imageUrl}
                          alt={unit.title ?? "Property listing"}
                          className="h-full w-full object-cover"
                          wrapperClassName="h-full"
                          sizes="(max-width: 640px) 100vw, 33vw"
                        />
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <h4 className="line-clamp-2 text-base font-semibold text-text-primary">{unit.title}</h4>
                        <p className="text-sm text-text-muted">{unit.location}</p>
                        <p className="text-lg font-bold text-text-primary">{formatDisplayCurrency((getDailyListingPricing(unit.numericId)?.actualPrice ?? 0) > 0 ? getDailyListingPricing(unit.numericId)!.actualPrice : unit.pricePerNight)}<span className="text-sm font-normal text-text-muted"> / night</span></p>
                        <Link
                          to={`${unit.canonicalPath}${querySuffix}`}
                          className="mt-auto inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--cta-primary-hover)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--cta-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                        >
                          {`View ${unitNoun.singular}`}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {isLoading && loadingTimeoutReached && (
          <div
            className="mb-4 flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-muted/60 px-4 py-3 text-sm text-text-secondary"
            data-testid="search-still-loading-banner"
            role="status"
          >
            Still loading live homes and prices — sample results will not appear until the refresh finishes or fails.
          </div>
        )}

        {isLoading && (
          <section
            data-testid="search-skeleton"
            aria-busy="true"
            aria-label="Loading search results"
          >
            <LoadingState kind="skeleton-card" count={8} />
          </section>
        )}

        {!isLoading && !(explicitDateSearch && dateAvailLoading) && !hasInvalidDates && mapView && (
          <div className="flex flex-col gap-3">
            <div className="relative">
              {showEmptyState && (
                <div className="absolute inset-x-0 top-4 z-10 mx-auto w-fit rounded-xl border border-border-subtle bg-bg-surface/95 px-4 py-3 text-sm text-text-secondary shadow-md text-center">
                  No matches in this area — try wider search or clear filters
                </div>
              )}
              <Suspense
                fallback={
                  <div
                    className="flex min-h-[50vh] items-center justify-center rounded-2xl border border-border-subtle bg-bg-surface text-text-muted"
                    data-testid="search-map-suspense"
                  >
                    Loading map…
                  </div>
                }
              >
                <SearchResultsMap
                  units={mapUnits}
                  formatPrice={formatDisplayCurrency}
                  querySuffix={querySuffix}
                  approximatePinHint={approximatePinHint}
                />
              </Suspense>
            </div>
            {/* TASK-1457: quick-scroll listing strip on small screens (map is primary). */}
            <div
              className="flex gap-3 overflow-x-auto pb-1 md:hidden"
              data-testid="search-map-mobile-strip"
              aria-label="Matching homes"
            >
              {sortedUnits.slice(0, 16).map((unit) => (
                <Link
                  key={`map-strip-${unit.id}`}
                  to={`${unit.canonicalPath}${querySuffix}`}
                  className="flex w-32 shrink-0 flex-col gap-1 rounded-xl border border-border-subtle bg-bg-surface p-2 shadow-sm"
                >
                  <div className="h-16 w-full overflow-hidden rounded-lg bg-bg-muted">
                    <OptimizedImage
                      src={unit.imageUrl}
                      alt={unit.title ?? "Listing"}
                      className="h-full w-full object-cover"
                      wrapperClassName="h-full"
                      sizes="128px"
                    />
                  </div>
                  {/* TASK-2574: text-sm for readability on 360px Android */}
                  <p className="line-clamp-2 text-sm font-medium text-text-primary">{unit.title}</p>
                  <p className="text-xs font-semibold text-cta-primary">{formatDisplayCurrency(unit.pricePerNight)}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {showingSampleListings && (
          <div
            className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            data-testid="search-static-fallback-banner"
            role="status"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <span>Showing sample homes — loading live prices and availability…</span>
          </div>
        )}

        {showDateAvailabilitySkeleton && (
          <section
            className="grid gap-6 sm:grid-cols-2"
            data-testid="search-date-availability-skeleton"
            aria-busy="true"
            aria-label="Checking availability for your dates"
          >
            <div className="col-span-full py-8">
              <div className="flex flex-col items-center justify-center gap-3 text-center">
                <div className="h-8 w-8 rounded-full border-4 border-border-subtle border-t-cta-primary animate-spin" aria-hidden />
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">Checking availability</p>
                  <p className="text-sm text-text-muted">Finding homes for your dates...</p>
                </div>
              </div>
            </div>
            <LoadingState kind="skeleton-card" count={4} />
          </section>
        )}

        {!isLoading && !showDateAvailabilitySkeleton && !showEmptyState && !hasInvalidDates && !mapView && (
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
                className="flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-sm transition-colors hover:border-border-subtle"
              >
                <div className="h-48 w-full bg-bg-muted">
                  <OptimizedImage
                    src={unit.imageUrl}
                    alt={unit.title ?? "Property listing"}
                    className="h-full w-full object-cover"
                    wrapperClassName="h-full"
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                </div>
                {/* TASK-1460: reserve chip row so layout does not jump when summary loads */}
                <div className="min-h-7 px-5 pt-3" data-testid="search-listing-availability-slot">
                  {explicitDateSearch ? (
                    dateAvailLoading ? (
                      <span className="inline-block h-5 w-16 rounded-full bg-bg-muted" aria-hidden />
                    ) : dateAvailableIds !== null ? (
                      <span
                        className="inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800"
                        data-testid="search-listing-availability-chip"
                      >
                        Available
                      </span>
                    ) : null
                  ) : (() => {
                    const chip = availabilityChip(availabilityById[unit.numericId]);
                    return chip ? (
                      <span
                        className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip.className}`}
                        data-testid="search-listing-availability-chip"
                      >
                        {chip.label}
                      </span>
                    ) : !availabilityFetchDone ? (
                      <span className="inline-block h-5 w-16 rounded-full bg-bg-muted" aria-hidden />
                    ) : null;
                  })()}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-text-primary">{unit.title}</h2>
                      {/* TASK-577: Show WiFi speed and co-working desk badges */}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {/* TASK-1674: use lucide icons instead of emoji for visual consistency */}
                        {unit.wifiSpeedMbps && unit.wifiSpeedMbps >= 25 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                            <Wifi className="h-3 w-3" /> WiFi {unit.wifiSpeedMbps}Mbps
                          </span>
                        )}
                        {unit.hasCoworkingDesk && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                            <Briefcase className="h-3 w-3" /> Co-working desk
                          </span>
                        )}
                        {/* TASK-1298: composite Atlas Trusted Host badge — shown when both verified photos and GST reg are present */}
                        {unit.hasVerifiedPhotos && unit.isGstRegistered ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200 cursor-help"
                            title="Verified photos and GST registration on file. Listing details reviewed before publish."
                          >
                            {`✅ ${brandName} Trusted Host`}
                          </span>
                        ) : (
                          <>
                            {/* TASK-1725: Atlas-verified photos badge */}
                            {unit.hasVerifiedPhotos && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                ✅ Verified photos
                              </span>
                            )}
                            {/* TASK-1727: GST registered badge */}
                            {unit.isGstRegistered && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200">
                                🧾 GST Reg.
                              </span>
                            )}
                          </>
                        )}
                        {/* TASK-1695: LOS discount badge — show highest configured tier */}
                        {unit.losDiscount2MinNights != null && unit.losDiscount2MinNights > 0 &&
                          unit.losDiscount2Percent != null && unit.losDiscount2Percent > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                            🏷️ Stay {unit.losDiscount2MinNights}+ nights — {unit.losDiscount2Percent}% off
                          </span>
                        ) : unit.losDiscountMinNights != null && unit.losDiscountMinNights > 0 &&
                          unit.losDiscountPercent != null && unit.losDiscountPercent > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                            🏷️ Stay {unit.losDiscountMinNights}+ nights — {unit.losDiscountPercent}% off
                          </span>
                        ) : null}
                      </div>
                      {/* TASK-4012: rating snippet + TASK-1660: match ListingCard — no catalog star average without verified review count */}
                      {(unit.reviewCount ?? 0) > 0 && unit.rating != null && unit.rating > 0 && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-yellow-50 border border-yellow-200 px-2.5 py-1 text-sm font-semibold text-yellow-800">
                          <span aria-hidden>★</span>
                          <span>{unit.rating.toFixed(1)}</span>
                          <span className="text-xs font-normal">({(unit.reviewCount ?? 0).toLocaleString()})</span>
                        </span>
                      )}
                      {/* TASK-1716: keyword-bucketed sentiment summary */}
                      <ReviewSummary listingId={unit.numericId} />
                    </div>
                    <span className="rounded-full bg-bg-muted px-3 py-1 text-xs font-semibold text-text-primary">
                      {unit.location}
                    </span>
                  </div>
                  {/* TASK-1705: Owner-share trust badge. BUG-7: removed nightlyPrice prop to stop leaking fabricated host payout amounts to guests. */}
                  <OwnerShareBadge className="self-start" />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      {(() => {
                        const dailyBreakdown = getDailyListingPricing(unit.numericId);
                        const displayedPrice = (dailyBreakdown?.actualPrice ?? 0) > 0 ? dailyBreakdown!.actualPrice : unit.pricePerNight;
                        return (
                          <>
                            <p className="text-2xl font-bold text-text-primary" data-testid="guest-listing-nightly-price">{formatDisplayCurrency(displayedPrice)}</p>
                            {isConverted && (
                              <p className="text-xs text-text-muted">{formatINR(displayedPrice)} on payment</p>
                            )}
                            <p className="text-sm text-text-muted">per night</p>
                            <p className="text-xs text-text-muted">
                              {formatEstTotalInclGst(displayedPrice, estimateNights, formatDisplayCurrency)}
                            </p>
                          </>
                        );
                      })()}
                      {longStay && (
                        <div className="text-sm font-semibold text-cta-primary">
                          {/* TASK-2077 / TASK-1661: monthly line uses configured LOS tier; otherwise nightly×30 + honest hint */}
                          {(() => {
                            const discountPct = unit.losDiscount2Percent ?? unit.losDiscountPercent ?? 0;
                            const base = unit.pricePerNight * 30;
                            const discounted =
                              discountPct > 0 ? Math.round(base * (1 - discountPct / 100)) : base;
                            return discountPct > 0 ? (
                              <p>{`from ${formatDisplayCurrency(discounted)}/month with long-stay discount`}</p>
                            ) : (
                              <>
                                <p>{`from ${formatDisplayCurrency(base)}/month at listed nightly rate`}</p>
                                <p className="mt-0.5 text-xs font-normal text-text-muted">
                                  Many hosts offer 15–20% off for 30+ nights; use the calculator below to plan.
                                </p>
                              </>
                            );
                          })()}
                        </div>
                      )}
                      {/* TASK-1739: LOS discount calculator — only shows when tiers are configured */}
                      <LongStayCalculator
                        pricePerNight={unit.pricePerNight}
                        tier1MinNights={unit.losDiscountMinNights}
                        tier1Percent={unit.losDiscountPercent}
                        tier2MinNights={unit.losDiscount2MinNights}
                        tier2Percent={unit.losDiscount2Percent}
                      />
                    </div>
                    <div className="flex flex-col gap-1 text-right text-xs text-text-muted">
                      {unit.amenities.slice(0, 4).map((amenity, index) => {
                        const code = amenity.amenities_icon?.trim();
                        if (!code) return null;
                        const label = resolveAmenityLabel(code);
                        if (!label) return null;
                        return (
                          <span key={`${unit.id}-amenity-${index}`} className="font-semibold text-text-secondary">
                            {label}
                          </span>
                        );
                      })}
                    </div>
                    <Link
                      to={`${unit.canonicalPath}${querySuffix}`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[var(--cta-primary-hover)] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[var(--cta-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                    >
                      {`View ${unitNoun.singular}`}
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
    </div>
  );
};

export default SearchPage;
