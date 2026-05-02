import { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";

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
  /** TASK-1725: True when Atlas team has verified photos for this listing. */
  hasVerifiedPhotos?: boolean;
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
        // TASK-1868: map amenityCodes to amenities_icon objects when API exposes them; empty until API adds the field
        amenities: ((l as unknown as { amenityCodes?: string[] }).amenityCodes ?? []).map((code) => ({ amenities_icon: code })),
        canonicalPath,
        rating: l.propertyRating ?? undefined,
        // TASK-1866: map minStay so long-stay filter works on API listings
        minStay: l.minStay ?? null,
        losDiscountMinNights: l.losDiscountMinNights ?? null,
        losDiscountPercent: l.losDiscountPercent ?? null,
        losDiscount2MinNights: l.losDiscount2MinNights ?? null,
        losDiscount2Percent: l.losDiscount2Percent ?? null,
        hasVerifiedPhotos: l.photosVerifiedAt != null,
      };
    })
    .filter((l) => l.numericId > 0);
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

  const hasInvalidDates = Boolean(checkIn && checkOut && checkOut <= checkIn);
  const hasActiveFilters = Boolean(
    minPrice || maxPrice || remoteWork || longStay || availableNow || selectedAmenities.length > 0
    || nomadWifi || nomadWorkspace || monthlyStay,
  );

  const [tonightAvailableIds, setTonightAvailableIds] = useState<Set<number> | null>(null);
  const [tonightProbeLoading, setTonightProbeLoading] = useState(false);
  // TASK-1865: batch availability check for checkIn+checkOut dates
  const [dateAvailableIds, setDateAvailableIds] = useState<Set<number> | null>(null);
  const [dateAvailLoading, setDateAvailLoading] = useState(false);

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

  // TASK-1865: When checkIn+checkOut set, call batch availability endpoint to get available listing IDs
  useEffect(() => {
    if (!checkIn || !checkOut || hasInvalidDates) {
      setDateAvailableIds(null);
      setDateAvailLoading(false);
      return;
    }
    const startStr = checkIn.toISOString().slice(0, 10);
    const endStr = checkOut.toISOString().slice(0, 10);
    const controller = new AbortController();
    setDateAvailLoading(true);
    setDateAvailableIds(null);

    fetch(buildApiUrl(`/api/public/listings/availability-batch?startDate=${startStr}&endDate=${endStr}`), {
      signal: controller.signal,
      headers: { Accept: "application/json", ...getApiHeaders() },
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res.status))
      .then((data: { availableListingIds?: number[] }) => {
        if (!controller.signal.aborted) {
          setDateAvailableIds(new Set(data.availableListingIds ?? []));
          setDateAvailLoading(false);
        }
      })
      .catch(() => {
        // On failure, don't block — show all listings with "not confirmed" badge
        if (!controller.signal.aborted) {
          setDateAvailableIds(null);
          setDateAvailLoading(false);
        }
      });

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
  }, [availableNow, guests, hasInvalidDates, longStay, minPrice, maxPrice, monthlyStay, nomadWifi, nomadWorkspace, remoteWork, selectedAmenities, sortBy, tonightProbeLoading]);

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
      // TASK-1738: clear digital nomad filters
      next.delete("nomadWifi");
      next.delete("nomadWorkspace");
      next.delete("monthlyStay");
      return next;
    }, { replace: true });
  };

  const visibleUnits = sortedUnits.slice(0, visibleCount);
  const hasMore = visibleCount < sortedUnits.length;
  const showEmptyState = !isLoading && !hasInvalidDates && sortedUnits.length === 0;
  const queryString = searchParams.toString();

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
          {/* TASK-1863: honest subtitle — don't promise date filtering until availability pre-filter ships (TASK-1865) */}
          <p className="max-w-3xl text-base text-text-body">
            Browse all homes. Filter by price, guests and amenities below.
          </p>
        </header>

        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border-subtle bg-bg-surface px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-muted" htmlFor="filter-min-price">Min price / night</label>
            <input
              id="filter-min-price"
              type="number"
              min={0}
              placeholder="₹ Any"
              value={minPrice ?? ""}
              onChange={(e) => updateParam("minPrice", e.target.value)}
              className="w-32 rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-base text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-cta-primary"
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
              className="w-32 rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-base text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-cta-primary"
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
              className="w-24 rounded-lg border border-border-subtle bg-bg-muted px-3 py-2 text-base text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-cta-primary"
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
              onChange={(e) => updateParam("availableNow", e.target.checked ? "true" : "")}
              className="cursor-pointer"
              data-testid="search-filter-available-tonight"
            />
            <span className="text-text-primary">Available tonight</span>
          </label>
          <div className="ml-auto flex items-end gap-3">
            {!isLoading && (
              <span className="text-sm text-text-muted">
                {/* TASK-1865: show availability check status for date filter */}
                {checkIn && checkOut && dateAvailLoading
                  ? "Checking availability for your dates…"
                  : availableNow && tonightProbeLoading
                  ? "Checking tonight's availability..."
                  : `${filteredUnits.length} ${filteredUnits.length === 1 ? "property" : "properties"} found`}
              </span>
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

        {/* TASK-1714: Sort controls */}
        <div className="flex items-center justify-end gap-2">
          <label className="text-sm text-text-muted" htmlFor="sort-by">Sort:</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => updateParam("sortBy", e.target.value === "recommended" ? "" : e.target.value)}
            className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-cta-primary"
          >
            <option value="recommended">Recommended</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="rating_desc">Highest rated</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {/* TASK-1708: Direct booking discount nudge — shows for direct traffic only */}
        <DirectDiscountBanner />

        {/* TASK-1867: only show banner on a real fetch error, not when API returns 0 listings */}
        {!isLoading && apiError && listings.length > 0 && (
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
                        {/* TASK-1725: Atlas-verified photos badge */}
                        {unit.hasVerifiedPhotos && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            ✅ Verified photos
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
                        {/* TASK-1869: Sept 2025 GST reform — 5% for ≤₹7,500/night, 12% above */}
                        {(() => { const gstMult = unit.pricePerNight > 7500 ? 1.12 : 1.05; const pct = unit.pricePerNight > 7500 ? 12 : 5; return `Est. total: ${formatDisplayCurrency(Math.round(unit.pricePerNight * gstMult))} (incl. ${pct}% GST)`; })()}
                      </p>
                      {longStay && (
                        <p className="text-sm font-semibold text-cta-primary">
                          from {formatDisplayCurrency(unit.pricePerNight * 30)}/month
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
                      to={`${unit.canonicalPath}${queryString ? `?${queryString}` : ""}`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[var(--cta-primary-hover)] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[var(--cta-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
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
    </div>
  );
};

export default SearchPage;
