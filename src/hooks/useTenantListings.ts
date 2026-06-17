import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchPublicListings,
  fetchPropertyListingPhotos,
  listingPhotosToSortedUrls,
  type ListingPhoto,
  type PublicListing,
} from "@/api/listingClient";
import { LISTINGS, type Listing } from "@/data/listings";
import { propertyData } from "@/data/propertyData";
import { getTenantContext } from "@/tenant/tenantContext";
import { getTenantOverrides, getTenantPublicListingIdAllowlist } from "@/tenant/tenantOverrides";

type LocalProperty = (typeof propertyData)[number];

export type TenantPropertyRecord = {
  id: number | string;
  listingId?: number;
  maxGuests?: number;
  unitType?: string;
  property_name?: string;
  property_description?: string;
  property_location?: string;
  property_neighborhoods?: string[];
  property_reviews?: number;
  property_rating?: number;
  property_img?: string[];
  property_amenities?: { amenities_icon: string; name: string }[];
  property_policy_details?: { type: string; value: string }[];
  /** TASK-1360: ISO date of most recent checkout within 30 days (for social proof badge). */
  lastBookedAt?: string | null;
  /** TASK-1695: LOS auto-discount tiers from public listings API. */
  losDiscountMinNights?: number | null;
  losDiscountPercent?: number | null;
  losDiscount2MinNights?: number | null;
  losDiscount2Percent?: number | null;
  lastMinuteDiscountPercent?: number | null;
  /** TL-GUEST: property pin from GET /listings/public — same source as Location page multi-pin. */
  latitude?: number | null;
  longitude?: number | null;
};

export type TenantListingsState = "idle" | "loading" | "error" | "success";

export type UseTenantListings = {
  listings: Listing[];
  properties: TenantPropertyRecord[];
  state: TenantListingsState;
  /** When `state === "error"`, message from API or network (if available). */
  fetchErrorMessage: string | null;
  refetch: () => Promise<void>;
};

const FALLBACK_LISTINGS: Listing[] = LISTINGS;
const FALLBACK_PROPERTIES: TenantPropertyRecord[] = propertyData as unknown as TenantPropertyRecord[];

const localPropertyByListingId = new Map<number, LocalProperty>(
  propertyData
    .filter((p): p is LocalProperty & { listingId: number } => typeof p.listingId === "number")
    .map((p) => [p.listingId as number, p]),
);

const extractPropertyNumberFromName = (name: string | undefined | null): number | null => {
  if (!name) return null;
  const match = name.match(/(\d{2,4})/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
};

const inferUnitTypeFromName = (name: string | undefined | null): string => {
  return (name ?? "").toLowerCase().includes("penthouse") ? "penthouse" : "1bhk";
};

const mapDtoToProperty = (dto: PublicListing, photosFromEndpoint: string[]): TenantPropertyRecord => {
  const local = localPropertyByListingId.get(dto.id);
  const propertyNumber =
    local?.id ??
    extractPropertyNumberFromName(dto.name ?? dto.propertyName) ??
    dto.id;

  const endpointPhotos = photosFromEndpoint.length > 0 ? photosFromEndpoint : null;
  const apiPhotos = dto.photoUrls && dto.photoUrls.length > 0 ? dto.photoUrls : null;
  const fallbackPhotos = local?.property_img ?? [];
  const photoUrls = endpointPhotos ?? apiPhotos ?? fallbackPhotos;

  return {
    id: propertyNumber,
    listingId: dto.id,
    maxGuests: dto.maxGuests || local?.maxGuests || 2,
    unitType: local?.unitType ?? inferUnitTypeFromName(dto.name ?? dto.propertyName),
    property_name:
      (dto.name?.trim() ? dto.name : null) ??
      (dto.propertyName?.trim() ? dto.propertyName : null) ??
      local?.property_name ??
      `Listing ${dto.id}`,
    property_description:
      local?.property_description ??
      `Comfortable stay for up to ${dto.maxGuests || local?.maxGuests || 2} guests.`,
    property_location: local?.property_location ?? dto.propertyAddress ?? "Hyderabad",
    property_neighborhoods: local?.property_neighborhoods ?? [],
    property_reviews: dto.reviewCount ?? local?.property_reviews ?? 0,
    property_rating: dto.propertyRating ?? local?.property_rating ?? 0,
    property_img: photoUrls,
    property_amenities: local?.property_amenities ?? [],
    property_policy_details: local?.property_policy_details ?? [],
    lastBookedAt: dto.lastBookedAt ?? null, // TASK-1360
    losDiscountMinNights: dto.losDiscountMinNights ?? null,
    losDiscountPercent: dto.losDiscountPercent ?? null,
    losDiscount2MinNights: dto.losDiscount2MinNights ?? null,
    losDiscount2Percent: dto.losDiscount2Percent ?? null,
    lastMinuteDiscountPercent: dto.lastMinuteDiscountPercent ?? null,
    latitude: dto.latitude ?? null,
    longitude: dto.longitude ?? null,
  };
};

const mapDtosToData = (
  dtos: PublicListing[],
  photosByListingId: Map<number, string[]>,
): { listings: Listing[]; properties: TenantPropertyRecord[] } => {
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  const tenantAllowedIds = getTenantPublicListingIdAllowlist(overrides);

  let properties = dtos
    .filter((dto) => dto.id > 0)
    .map((dto) => mapDtoToProperty(dto, photosByListingId.get(dto.id) ?? []));

  // Marketplace tenant shows all listings; other tenants apply the allowlist filter
  if (tenantAllowedIds.size > 0 && tenant?.slug !== 'marketplace') {
    properties = properties.filter((p) => {
      const lid = p.listingId != null ? Number(p.listingId) : NaN;
      return Number.isFinite(lid) && tenantAllowedIds.has(lid);
    });
  }

  const listings: Listing[] = properties.map((p) => ({
    id: p.id,
    title: p.property_name ?? "",
    subtitle: p.property_description
      ? `${p.property_description.slice(0, 100)}...`
      : "",
    unitType: p.unitType,
    featured: p.id === 501,
  }));

  return { listings, properties };
};

export function useTenantListings(): UseTenantListings {
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  const onlyApi = overrides.onlyApiListings === true;
  const filteredFallback = onlyApi ? [] : FALLBACK_PROPERTIES;
  const filteredListings = onlyApi ? [] : FALLBACK_LISTINGS;

  const [data, setData] = useState<{ listings: Listing[]; properties: TenantPropertyRecord[] }>({
    listings: filteredListings,
    properties: filteredFallback,
  });
  const [state, setState] = useState<TenantListingsState>("idle");
  const [fetchErrorMessage, setFetchErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasFetchedRef = useRef(false);

  const refetch = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState("loading");
    setFetchErrorMessage(null);

    try {
      const dtos = await fetchPublicListings(controller.signal);
      if (controller.signal.aborted) return;

      // Fetch photos for each unique property (with caching to avoid redundant calls)
      const photosByListingId = new Map<number, string[]>();
      const uniquePropertyIds = [
        ...new Set(
          dtos
            .map((d) => d.propertyId)
            .filter((id): id is number => id != null && id > 0),
        ),
      ];
      const photosByPropertyId = new Map<number, ListingPhoto[]>();

      // Use shared cache if available, otherwise fetch
      await Promise.all(
        uniquePropertyIds.map(async (pid) => {
          try {
            const photos = await fetchPropertyListingPhotos(pid, controller.signal);
            photosByPropertyId.set(pid, photos);
          } catch (error) {
            console.warn(`[useTenantListings] Failed to fetch photos for property ${pid}:`, error);
            /* keep dto.photoUrls / local fallback */
          }
        }),
      );

      for (const dto of dtos) {
        if (dto.id <= 0 || dto.propertyId == null || dto.propertyId <= 0) continue;
        const rows = photosByPropertyId.get(dto.propertyId) ?? [];
        const urls = listingPhotosToSortedUrls(rows, dto.id);
        if (urls.length > 0) photosByListingId.set(dto.id, urls);
      }
      if (controller.signal.aborted) return;

      const mapped = mapDtosToData(dtos, photosByListingId);
      setData(mapped);
      setState("success");
    } catch (error) {
      if (controller.signal.aborted) return;
      console.warn("[useTenantListings] failed; falling back to bundled data", error);
      setFetchErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "We're having trouble loading apartments right now. Please try again.",
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void refetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [refetch]);

  return { listings: data.listings, properties: data.properties, state, fetchErrorMessage, refetch };
}
