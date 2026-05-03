import { lazy, Suspense, useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

import { propertyData } from "../data";
import { fetchPublicListings, type PublicListing } from "../api/listingClient";
import { parseDate } from "../utils/formatting";
import { useCurrency } from "../contexts/CurrencyContext";
import { buildHomeUnitPath, getPropertySlug } from "../utils/navigation";
import SkeletonCard from "../components/apartments/SkeletonCard";
import OptimizedImage from "../components/ui/OptimizedImage";
import OwnerShareBadge from "../components/OwnerShareBadge"; // TASK-1705
import DirectDiscountBanner from "../components/DirectDiscountBanner"; // TASK-1708
import ReviewSummary from "../components/ReviewSummary"; // TASK-1716
import LongStayCalculator from "../components/LongStayCalculator"; // TASK-1739
import { filterGuestImageUrls, sanitizeGuestImageUrl } from "../utils/guestImageUrl";
import { compareAtlasHomesBuildingOrder } from "../utils/atlasHomesBuildingOrder";
import { buildApiUrl, getApiHeaders } from "../api/client";
import {
  fetchAvailabilitySummary,
  type ListingAvailabilitySummary,
} from "../api/availabilitySummaryClient";
import RecentlyViewedStrip from "../components/RecentlyViewedStrip";
import { fallbackCoordsForListing, hasMapCoords } from "../utils/mapCoords";

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
      const pin = fallbackCoordsForListing(id);

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
        title: l.name || l.propertyName,
        location: l.propertyAddress ?? "Hyderabad",
        pricePerNight: l.baseNightlyRate ?? 0,
        maxGuests: l.maxGuests,
        imageUrl:
          filterGuestImageUrls(l.photoUrls ?? [])[0] ?? sanitizeGuestImageUrl(l.coverPhotoUrl) ?? "",
        // TASK-1868: map amenityCodes to amenities_icon objects when API exposes them; empty until API adds the field
        amenities: ((l as unknown as { amenityCodes?: string[] }).amenityCodes ?? []).map((code) => ({ amenities_icon: code })),
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
      };
    })
    .filter((l) => l.numericId > 0);
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
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(true);
  const [apiListings, setApiListings] = useState<NormalizedListing[] | null>(null);
  // TASK-1867: track real API errors separately; null apiListings on 0-listing response is not an error
  const [apiError, setApiError] = useState(false);

  const loadFromApi = useCallback(async (signal: AbortSignal) => {
    setApiError(false);
    try {
      const data = await fetchPublicListings(signal);
      // TASK-1867: always set apiListings (even empty array) so 0-listing response doesn't look like an error
      setApiListings(apiToNormalized(data));
    } catch {
      // API failed — static fallback is used automatically; flag for honest banner
      setApiError(true);
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
  const longStay = searchParams.get("longStay") === "true";
  /** TASK-1297: filter to listings with inventory for tonight (IST). */
  const availableNow = searchParams.get("availableNow") === "true";
  const amenitiesParam = searchParams.get("amenities") || "";
  const selectedAmenities = amenitiesParam ? amenitiesParam.split(",") : [];
  /** TASK-1714: sort order — default "recommended" (Atlas building/floor order). */
  const sortBy = searchParams.get("sortBy") || "recommended";
  /** TASK-1738: Digital nomad filter chips. */
  const nomadWifi = searchParams.get("nomadWifi") === "true";       // WiFi 50+ Mbps
  const nomadWorkspace = searchParams.get("nomadWorkspace") === "true"; // dedicated workspace
  const monthlyStay = searchParams.get("monthlyStay") === "true";   // 30+ nights min stay
  /** TASK-1457: list vs map layout for search results. */
  const mapView = searchParams.get("view") === "map";

  const hasInvalidDates = Boolean(checkIn && checkOut && checkOut <= checkIn);
  const explicitDateSearch = Boolean(checkIn && checkOut);
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

  const listings = useMemo(
    () => apiListings ?? buildStaticListings(),
    [apiListings],
  );

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
        if (!res.ok) return false;
        const j = (await res.json()) as {
          availability?: { date?: string; Date?: string; status?: string; Status?: string; inventory?: number; Inventory?: number }[];
          Availability?: { date?: string; Date?: string; status?: string; Status?: string; inventory?: number; Inventory?: number }[];
        };
        const days = j.availability ?? j.Availability ?? [];
        const row = days.find((d) => (d.date ?? d.Date) === today);
        if (!row) return false;
        const st = String(row.status ?? row.Status ?? "").toLowerCase();
        const inv = Number(row.inventory ?? row.Inventory ?? 0);
        if (st === "blocked" || st === "hold") return false;
        return inv > 0 || st === "available" || st === "turnover";
      } catch {
        return false;
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
    const amenityIcons = (unit.amenities || []).map(a => (a.amenities_icon || "").toLowerCase());
    // TASK-1711: expanded amenity map — Pet-friendly + Balcony added to reach 8 total filter chips.
    const amenityMap: Record<string, string[]> = {
      ac: ["ac", "air conditioning", "air-conditioner"],
      parking: ["parking", "garage"],
      pool: ["pool", "swimming"],
      wifi: ["wifi", "internet"],
      "pet-friendly": ["pet", "dog", "cat"],
      balcony: ["balcony", "terrace", "patio", "deck"],
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
      // TASK-1865: exclude listings confirmed unavailable for selected dates; skip when still loading or fetch failed
      if (checkIn && checkOut && !dateAvailLoading && dateAvailableIds !== null) {
        if (!dateAvailableIds.has(unit.numericId)) return false;
      }
      // TASK-577: Filter by remote work friendliness (co-working desk or WiFi >= 25 Mbps)
      if (remoteWork) {
        const isRemoteWorkFriendly = (unit as any).hasCoworkingDesk || ((unit as any).wifiSpeedMbps ?? 0) >= 25;
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
        if (((unit as any).wifiSpeedMbps ?? 0) < 50) return false;
      }
      if (nomadWorkspace) {
        const hasWorkspace = hasAmenity(unit, "Workspace") || hasAmenity(unit, "Desk") || (unit as any).hasCoworkingDesk;
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
        if (tonightProbeLoading || tonightAvailableIds === null) return false;
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
    guests,
    hasInvalidDates,
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
    const ids = sortedUnits.map((u) => u.numericId).filter((id) => id > 0).slice(0, 48);
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
  const showEmptyState = !isLoading && !hasInvalidDates && sortedUnits.length === 0;
  /** TASK-1648: skeleton while public availability resolves for selected dates (list view). */
  const showDateAvailabilitySkeleton =
    explicitDateSearch && !hasInvalidDates && dateAvailLoading && !isLoading && !mapView;
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
  /** TASK-1451: first three catalog listings as "you might also like" (same pool as `fetchPublicListings`; no extra round-trip). */
  const emptyStateSuggestions = useMemo(
    () => (listings.length > 0 ? listings.slice(0, 3) : []),
    [listings],
  );

  return (
    <div className="min-h-screen bg-bg-muted py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 md:px-8">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">Search results</p>
          {/* TASK-1864: dynamic h1 — only say "homes for your dates" when dates are actually set */}
          <h1 className="text-3xl font-bold text-text-primary sm:text-4xl">
            {checkIn && checkOut
              ? `${filteredUnits.length} ${filteredUnits.length === 1 ? "home" : "homes"} for your dates`
              : "Atlas Homestays"}
          </h1>
          <p className="max-w-3xl text-base text-text-body">
            {checkIn && checkOut && !hasInvalidDates
              ? "Homes below are filtered to those available for your dates when our live check succeeds. You can still refine with price, guests, and amenities."
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
          {(!checkIn || !checkOut) && (
          <label className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-sm">
            <input
              type="checkbox"
              id="filter-available-tonight"
              checked={availableNow}
              onChange={(e) => updateParam("availableNow", e.target.checked ? "true" : "")}
              className="cursor-pointer"
              data-testid="search-filter-available-tonight"
            />
            <span className="text-text-primary">Available tonight</span>
          </label>
          )}
          <div className="ml-auto flex items-end gap-3">
            {!isLoading && (
              <span className="text-sm text-text-muted">
                {/* TASK-1865: show availability check status for date filter */}
                {checkIn && checkOut && dateAvailLoading
                  ? "Checking availability for your dates…"
                  : availableNow && tonightProbeLoading
                  ? "Checking tonight's availability..."
                  : filteredUnits.length === 0 && hasActiveFilters
                  ? "No properties match your filters"
                  : `${filteredUnits.length} ${filteredUnits.length === 1 ? "property" : "properties"} found`}
              </span>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 rounded-lg border border-border-subtle px-4 py-3 text-sm font-medium text-text-muted hover:bg-bg-muted focus:outline-none"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Amenity filters — TASK-1711: 6 basic chips + 2 nomad chips = 8 total */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Amenities:</span>
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
          <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Digital nomad:</span>
          {[
            { label: "📶 WiFi 50+ Mbps", param: "nomadWifi",    active: nomadWifi },
            { label: "💻 Workspace",      param: "nomadWorkspace", active: nomadWorkspace },
            { label: "📅 7+ nights",      param: "longStay",    active: longStay },
            { label: "🗓️ 30+ nights",     param: "monthlyStay", active: monthlyStay },
          ].map(({ label, param, active }) => (
            <button
              key={param}
              onClick={() => updateParam(param, active ? "" : "true")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-11 ${
                active
                  ? "bg-emerald-600 text-white border border-emerald-600"
                  : "bg-bg-surface border border-border-subtle text-text-primary hover:border-emerald-500"
              } focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2`}
              aria-pressed={active}
            >
              {label}
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
              <option value="recommended" title="Sorted by Atlas building/floor preference">Recommended</option>
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
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`avail-sk-${i}`} className={i >= 4 ? "hidden sm:block" : ""}>
                <SkeletonCard />
              </div>
            ))}
          </section>
        )}

        {/* TASK-1867: only show banner on a real fetch error, not when API returns 0 listings */}
        {!isLoading && apiError && listings.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-support-warning/40 bg-support-warning/10 px-4 py-3 text-support-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <span>Live availability check failed. Showing cached results — call +91 7032 493 290 to confirm before booking.</span>
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
              <div className="mx-auto mb-6 flex max-w-xs justify-center" aria-hidden>
                <img
                  src="/images/atlas-homestays-static-map.svg"
                  alt=""
                  className="h-28 w-auto max-w-full object-contain opacity-90"
                />
              </div>
              <h2 className="text-xl font-bold text-text-primary sm:text-2xl">No homestays match your filters</h2>
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
                      <div className="h-36 w-full bg-gradient-to-br from-bg-muted to-bg-surface">
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
                        <p className="text-lg font-bold text-text-primary">{formatDisplayCurrency(unit.pricePerNight)}<span className="text-sm font-normal text-text-muted"> / night</span></p>
                        <Link
                          to={`${unit.canonicalPath}${querySuffix}`}
                          className="mt-auto inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--cta-primary-hover)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--cta-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                        >
                          View home
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {isLoading && (
          <section
            className="grid gap-6 sm:grid-cols-2"
            data-testid="search-skeleton"
            aria-busy="true"
            aria-label="Loading search results"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={i >= 4 ? "hidden sm:block" : ""}>
                <SkeletonCard />
              </div>
            ))}
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
                  className="flex w-28 shrink-0 flex-col gap-1 rounded-xl border border-border-subtle bg-bg-surface p-2 shadow-sm"
                >
                  <div className="h-16 w-full overflow-hidden rounded-lg bg-bg-muted">
                    <OptimizedImage
                      src={unit.imageUrl}
                      alt={unit.title ?? "Listing"}
                      className="h-full w-full object-cover"
                      wrapperClassName="h-full"
                      sizes="112px"
                    />
                  </div>
                  <p className="line-clamp-2 text-xs font-medium text-text-primary">{unit.title}</p>
                  <p className="text-xs font-semibold text-cta-primary">{formatDisplayCurrency(unit.pricePerNight)}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {showDateAvailabilitySkeleton && (
          <section
            className="grid gap-6 sm:grid-cols-2"
            data-testid="search-date-availability-skeleton"
            aria-busy="true"
            aria-label="Checking availability for your dates"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`avail-skel-${i}`} className={i >= 4 ? "hidden sm:block" : ""}>
                <SkeletonCard />
              </div>
            ))}
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
                {/* TASK-1460: reserve chip row so layout does not jump when summary loads */}
                <div className="min-h-7 px-5 pt-3" data-testid="search-listing-availability-slot">
                  {!explicitDateSearch ? (() => {
                    const chip = availabilityChip(availabilityById[unit.numericId]);
                    return chip ? (
                      <span
                        className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip.className}`}
                        data-testid="search-listing-availability-chip"
                      >
                        {chip.label}
                      </span>
                    ) : !availabilityFetchDone ? (
                      <span className="inline-block h-5 w-16 animate-pulse rounded-full bg-bg-muted" aria-hidden />
                    ) : null;
                  })() : null}
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
                      {unit.rating != null && unit.rating > 0 && (
                        <p className="mt-0.5 text-sm text-accent-primary font-medium">
                          {"★".repeat(Math.round(unit.rating))}<span className="text-text-muted ml-1">{unit.rating.toFixed(1)}</span>
                          {unit.reviewCount != null && unit.reviewCount > 0 && (
                            <span className="text-text-muted ml-1 text-xs">({unit.reviewCount})</span>
                          )}
                        </p>
                      )}
                      {/* TASK-1716: keyword-bucketed sentiment summary */}
                      <ReviewSummary listingId={unit.numericId} />
                    </div>
                    <span className="rounded-full bg-bg-muted px-3 py-1 text-xs font-semibold text-text-primary">
                      {unit.location}
                    </span>
                  </div>
                  {/* TASK-1705: Owner-share trust badge */}
                  <OwnerShareBadge nightlyPrice={unit.pricePerNight} className="self-start" />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-text-primary" data-testid="guest-listing-nightly-price">{formatDisplayCurrency(unit.pricePerNight)}</p>
                      {isConverted && (
                        <p className="text-xs text-text-muted">{formatINR(unit.pricePerNight)} on payment</p>
                      )}
                      <p className="text-sm text-text-muted">per night</p>
                      <p className="text-xs text-text-muted">
                        {/* TASK-1869 / TASK-1451: Sept 2025 GST reform — 5% for ≤₹7,500/night, 18% above */}
                        {(() => { const gstMult = unit.pricePerNight > 7500 ? 1.12 : 1.05; const pct = unit.pricePerNight > 7500 ? 12 : 5; return `Est. total: ${formatDisplayCurrency(Math.round(unit.pricePerNight * gstMult))} (incl. ${pct}% GST)`; })()}
                      </p>
                      {longStay && (
                        <p className="text-sm font-semibold text-cta-primary">
                          {/* TASK-2077: apply LOS discount to monthly estimate when tier is configured */}
                          {(() => {
                            const discountPct = unit.losDiscount2Percent ?? unit.losDiscountPercent ?? 0;
                            const base = unit.pricePerNight * 30;
                            const discounted = discountPct > 0 ? Math.round(base * (1 - discountPct / 100)) : base;
                            return discountPct > 0
                              ? `from ${formatDisplayCurrency(discounted)}/month with long-stay discount`
                              : `from ${formatDisplayCurrency(base)}/month`;
                          })()}
                        </p>
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
                      {unit.amenities.map((amenity, index) => (
                        <span key={`${unit.id}-amenity-${index}`} className="font-semibold text-text-secondary">
                          {amenity.amenities_icon}
                        </span>
                      ))}
                    </div>
                    <Link
                      to={`${unit.canonicalPath}${querySuffix}`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[var(--cta-primary-hover)] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[var(--cta-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                    >
                      View home
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
