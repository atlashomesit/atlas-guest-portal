import { useCallback, useEffect, useRef, useState } from "react";

import { fetchListingPhotos, fetchPublicListings, type PublicListing } from "@/api/listingClient";
import { LISTINGS, type Listing } from "@/data/listings";
import { propertyData } from "@/data/propertyData";
import { getTenantContext } from "@/tenant/tenantContext";
import { getTenantOverrides } from "@/tenant/tenantOverrides";

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
  /** TASK-1649: discount rule percents from public listings API (0 when absent). */
  losDiscountPercent?: number | null;
  losDiscount2Percent?: number | null;
  lastMinuteDiscountPercent?: number | null;
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
    property_name: dto.name ?? local?.property_name ?? dto.propertyName ?? `Listing ${dto.id}`,
    property_description:
      local?.property_description ??
      `Comfortable stay for up to ${dto.maxGuests || local?.maxGuests || 2} guests.`,
    property_location: local?.property_location ?? dto.propertyAddress ?? "Hyderabad",
    property_neighborhoods: local?.property_neighborhoods ?? [],
    property_reviews: local?.property_reviews ?? 0,
    property_rating: local?.property_rating ?? dto.propertyRating ?? 0,
    property_img: photoUrls,
    property_amenities: local?.property_amenities ?? [],
    property_policy_details: local?.property_policy_details ?? [],
    lastBookedAt: dto.lastBookedAt ?? null, // TASK-1360
    losDiscountPercent: dto.losDiscountPercent ?? null,
    losDiscount2Percent: dto.losDiscount2Percent ?? null,
    lastMinuteDiscountPercent: dto.lastMinuteDiscountPercent ?? null,
  };
};

const mapDtosToData = (
  dtos: PublicListing[],
  photosByListingId: Map<number, string[]>,
): { listings: Listing[]; properties: TenantPropertyRecord[] } => {
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  const tenantAllowedIds = new Set((overrides.homes ?? []).map(h => Number(h.roomNo)));

  let properties = dtos
    .filter((dto) => dto.id > 0)
    .map((dto) => mapDtoToProperty(dto, photosByListingId.get(dto.id) ?? []));

  // Filter to only tenant-allowed properties if homes list is defined
  if (tenantAllowedIds.size > 0) {
    properties = properties.filter(p => tenantAllowedIds.has(Number(p.id)));
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
  const [data, setData] = useState<{ listings: Listing[]; properties: TenantPropertyRecord[] }>({
    listings: FALLBACK_LISTINGS,
    properties: FALLBACK_PROPERTIES,
  });
  const [state, setState] = useState<TenantListingsState>("idle");
  const [fetchErrorMessage, setFetchErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState("loading");
    setFetchErrorMessage(null);

    try {
      const dtos = await fetchPublicListings(controller.signal);
      if (controller.signal.aborted) return;

      const photosByListingId = new Map<number, string[]>();
      await Promise.all(
        dtos.map(async (dto) => {
          if (dto.id <= 0) return;
          try {
            const urls = await fetchListingPhotos(dto.id, controller.signal);
            if (urls.length > 0) {
              photosByListingId.set(dto.id, urls);
            }
          } catch {
            /* keep dto.photoUrls / local fallback */
          }
        }),
      );
      if (controller.signal.aborted) return;

      const mapped = mapDtosToData(dtos, photosByListingId);
      if (mapped.properties.length === 0) {
        // Keep the fallback so the page never goes blank on an empty/unfiltered response.
        setState("success");
        return;
      }
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
    void refetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [refetch]);

  return { listings: data.listings, properties: data.properties, state, fetchErrorMessage, refetch };
}
