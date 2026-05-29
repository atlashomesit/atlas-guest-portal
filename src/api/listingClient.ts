import { buildApiUrl, getApiHeaders } from '@/api/client';
import { messageFromApiResponse } from '@/utils/serverErrorFromResponse';

/** Parse maxGuests from listing JSON (camelCase or PascalCase). Returns undefined if missing/invalid. */
export function parseMaxGuestsFromPayload(payload: Record<string, unknown>): number | undefined {
  const raw = payload.maxGuests ?? payload.MaxGuests;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.min(16, Math.floor(n)) : undefined;
}

/** Static catalog rows: prefer API-shaped maxGuests, else numeric maxCapacity (capped at 16). */
export function resolveStaticMaxGuests(source: Record<string, unknown>): number | undefined {
  const fromApi = parseMaxGuestsFromPayload(source);
  if (fromApi != null) return fromApi;
  const cap = Number(source.maxCapacity);
  return Number.isFinite(cap) && cap >= 1 ? Math.min(16, Math.floor(cap)) : undefined;
}

export type ListingDetail = {
  id: string | number;
  propertyId?: string | number;
  name?: string;
  coverPhotoUrl?: string;
  photoUrls?: string[];
  [key: string]: unknown;
};

const LISTING_ENDPOINT = '/listings';
const PUBLIC_LISTINGS_ENDPOINT = '/listings/public';

/**
 * Matches Atlas API `ListingPhotoDto` from `GET /listings/{propertyId}/photos`
 * (feat: aggregate all units on a property — each row includes `listingId`).
 */
export type ListingPhoto = {
  id: number;
  listingId: number;
  url: string;
  originalFileName: string | null;
  sortOrder: number;
  caption: string | null;
  isCover: boolean;
};

/** Parse JSON array from GET /listings/{propertyId}/photos into typed rows (ignores invalid entries). */
export function parseListingPhotosResponse(payload: unknown): ListingPhoto[] {
  if (!Array.isArray(payload)) return [];
  const out: ListingPhoto[] = [];
  for (const raw of payload) {
    if (!raw || typeof raw !== 'object' || typeof (raw as { url?: unknown }).url !== 'string') continue;
    const o = raw as Record<string, unknown>;
    const listingId = Number(o.listingId ?? o.ListingId);
    const url = (o.url as string).trim();
    if (!Number.isFinite(listingId) || listingId <= 0 || !url) continue;
    const id = Number(o.id ?? o.Id);
    const sortOrder = Number(o.sortOrder ?? o.SortOrder);
    const ofn = o.originalFileName ?? o.OriginalFileName;
    const cap = o.caption ?? o.Caption;
    out.push({
      id: Number.isFinite(id) ? id : 0,
      listingId,
      url,
      originalFileName: typeof ofn === 'string' ? ofn : null,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      caption: typeof cap === 'string' ? cap : null,
      isCover: Boolean(o.isCover ?? o.IsCover),
    });
  }
  return out;
}

/** Ordered URL list from typed photo rows (optional filter to one `listingId`). */
export function listingPhotosToSortedUrls(photos: ListingPhoto[], listingId?: number): string[] {
  let rows =
    listingId != null && listingId > 0 ? photos.filter((p) => p.listingId === listingId) : [...photos];
  rows = rows.sort(
    (a, b) =>
      (listingId != null && listingId > 0
        ? a.sortOrder - b.sortOrder
        : a.listingId - b.listingId || a.sortOrder - b.sortOrder),
  );
  return rows.map((p) => p.url).filter(Boolean);
}

/** Shape aligned with API `PublicListingDto` (camelCase JSON). */
export type PublicListing = {
  id: number;
  propertyId?: number;
  propertyName?: string;
  propertyAddress?: string | null;
  name?: string;
  floor?: number;
  type?: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  status?: string;
  maxGuests: number;
  baseNightlyRate?: number | null;
  currency?: string;
  coverPhotoUrl?: string | null;
  photoUrls?: string[];
  timezoneId?: string;
  /** Pre-booking: not returned by API (TASK-1466). Filled from `fetchListingContact` when `bookingId`+`t` are known. */
  hostPhone?: string | null;
  /** TASK-543: Property-level aggregate rating shown on search cards. */
  propertyRating?: number | null;
  /** TASK-577: WiFi speed in Mbps for digital nomad filtering. */
  wifiSpeedMbps?: number | null;
  /** TASK-577: Whether co-working desk is available. */
  hasCoworkingDesk?: boolean;
  /** TASK-1025: Minimum stay requirement in nights. */
  minStay?: number | null;
  /** TASK-1695: LOS auto-discount tier 1 — minimum nights threshold (null = disabled). */
  losDiscountMinNights?: number | null;
  /** TASK-1695: LOS auto-discount tier 1 — discount percent (null = disabled). */
  losDiscountPercent?: number | null;
  /** TASK-1695: LOS auto-discount tier 2 — minimum nights threshold (null = disabled). */
  losDiscount2MinNights?: number | null;
  /** TASK-1695: LOS auto-discount tier 2 — discount percent (null = disabled). */
  losDiscount2Percent?: number | null;
  /** Optional last-minute discount percent when API exposes it (TASK-1649). */
  lastMinuteDiscountPercent?: number | null;
  /** TASK-1725: UTC ISO string when Atlas team verified listing photos. Null = not verified. */
  photosVerifiedAt?: string | null;
  /** TASK-1727: True when the tenant has a registered GSTIN — shown as trust badge on listing cards. */
  isGstRegistered?: boolean;
  /** TASK-1360: ISO date string of most recent checkout within 30 days, or null. */
  lastBookedAt?: string | null;
  /** TASK-1457: Property coordinates from API (null when unset). */
  latitude?: number | null;
  longitude?: number | null;
  /** TASK-2076: Total number of verified reviews. Null when no reviews yet. */
  reviewCount?: number | null;
  /** TASK-1385: Cancellation policy tier — "Flexible", "Moderate", or "Strict". Null when host hasn't set one. */
  cancellationTier?: 'Flexible' | 'Moderate' | 'Strict' | null;
  /** TASK-2552: amenity code strings (e.g. "AC", "Pool", "WiFi") returned by PublicListingDto. */
  amenityCodes?: string[];
  /**
   * TASK-2739-v1: publish state ("Draft" | "Published"). Discovery lists only ever contain
   * "Published" rows; on a detail fetch a "Draft" value drives noindex + the "not yet available
   * for booking" notice. Undefined on legacy payloads (treated as published/live).
   */
  publishStatus?: string;
};

function normalizePublicListing(payload: Record<string, unknown>): PublicListing {
  const id = Number(payload.id);
  const maxGuests = Number(payload.maxGuests ?? payload.MaxGuests ?? 0);
  const rawRate = payload.baseNightlyRate;
  const photos = payload.photoUrls;
  const minStay = payload.minStay != null ? Number(payload.minStay) : null;
  const rawLat = payload.latitude ?? payload.Latitude;
  const rawLng = payload.longitude ?? payload.Longitude;
  const latitude =
    rawLat == null || rawLat === '' ? null : Number(rawLat);
  const longitude =
    rawLng == null || rawLng === '' ? null : Number(rawLng);
  return {
    id: Number.isFinite(id) ? id : 0,
    propertyId:
      payload.propertyId != null && payload.propertyId !== ''
        ? Number(payload.propertyId)
        : undefined,
    propertyName: typeof payload.propertyName === 'string' ? payload.propertyName : undefined,
    propertyAddress:
      payload.propertyAddress === null || typeof payload.propertyAddress === 'string'
        ? (payload.propertyAddress as string | null)
        : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    floor: payload.floor != null ? Number(payload.floor) : undefined,
    type: typeof payload.type === 'string' ? payload.type : undefined,
    checkInTime:
      payload.checkInTime === null || typeof payload.checkInTime === 'string'
        ? (payload.checkInTime as string | null)
        : undefined,
    checkOutTime:
      payload.checkOutTime === null || typeof payload.checkOutTime === 'string'
        ? (payload.checkOutTime as string | null)
        : undefined,
    status: typeof payload.status === 'string' ? payload.status : undefined,
    maxGuests: Number.isFinite(maxGuests) ? maxGuests : 0,
    baseNightlyRate:
      rawRate == null || rawRate === '' ? null : Number(rawRate),
    currency: typeof payload.currency === 'string' ? payload.currency : undefined,
    coverPhotoUrl:
      payload.coverPhotoUrl === null || typeof payload.coverPhotoUrl === 'string'
        ? (payload.coverPhotoUrl as string | null)
        : undefined,
    photoUrls: Array.isArray(photos) ? photos.filter((u): u is string => typeof u === 'string') : [],
    timezoneId: typeof payload.timezoneId === 'string' ? payload.timezoneId : undefined,
    hostPhone:
      payload.hostPhone === null || typeof payload.hostPhone === 'string'
        ? (payload.hostPhone as string | null)
        : undefined,
    propertyRating:
      payload.propertyRating == null || payload.propertyRating === ''
        ? null
        : Number(payload.propertyRating),
    wifiSpeedMbps:
      payload.wifiSpeedMbps == null || payload.wifiSpeedMbps === ''
        ? null
        : Number(payload.wifiSpeedMbps),
    hasCoworkingDesk: Boolean(payload.hasCoworkingDesk),
    minStay: Number.isFinite(minStay) && minStay > 0 ? minStay : null,
    losDiscountMinNights:
      payload.losDiscountMinNights != null ? Number(payload.losDiscountMinNights) : null,
    losDiscountPercent:
      payload.losDiscountPercent != null ? Number(payload.losDiscountPercent) : null,
    losDiscount2MinNights:
      payload.losDiscount2MinNights != null ? Number(payload.losDiscount2MinNights) : null,
    losDiscount2Percent:
      payload.losDiscount2Percent != null ? Number(payload.losDiscount2Percent) : null,
    lastMinuteDiscountPercent:
      payload.lastMinuteDiscountPercent != null ? Number(payload.lastMinuteDiscountPercent) : null,
    isGstRegistered: Boolean(payload.isGstRegistered), // TASK-1727
    lastBookedAt: typeof payload.lastBookedAt === 'string' ? payload.lastBookedAt : null, // TASK-1360
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    reviewCount: payload.reviewCount != null ? Number(payload.reviewCount) : null,
    cancellationTier: (payload.cancellationTier === 'Flexible' || payload.cancellationTier === 'Moderate' || payload.cancellationTier === 'Strict')
      ? payload.cancellationTier
      : null, // TASK-1385
    // TASK-2552: wire amenityCodes from API so nomad/amenity filters and badges work
    amenityCodes: Array.isArray(payload.amenityCodes)
      ? payload.amenityCodes.filter((x): x is string => typeof x === 'string')
      : [],
    // TASK-2739-v1: publish state drives noindex + the "not yet available" notice on Draft detail pages.
    publishStatus: typeof payload.publishStatus === 'string' ? payload.publishStatus : undefined,
  };
}

const coercePublicListingsPayload = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) {
    return payload.filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object');
  }
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    // Try common wrapper properties: items, data, results, value, values
    const arrayField = obj.items ?? obj.data ?? obj.results ?? obj.value ?? obj.values;
    if (Array.isArray(arrayField)) {
      return arrayField.filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object');
    }
  }
  return [];
};

/** TASK-1466: host contact after booking — requires same `t` nonce as guest booking APIs. */
export type ListingContact = {
  hostPhone?: string | null;
  hostEmail?: string | null;
  hostName?: string;
};

export async function fetchListingContact(
  listingId: number,
  bookingId: number,
  token: string,
  signal?: AbortSignal,
): Promise<ListingContact | null> {
  if (!Number.isFinite(listingId) || listingId <= 0 || !Number.isFinite(bookingId) || bookingId <= 0) return null;
  const t = token.trim();
  if (!t) return null;
  const q = new URLSearchParams({ bookingId: String(bookingId), t });
  const response = await fetch(buildApiUrl(`/api/listings/${listingId}/contact?${q}`), {
    signal,
    headers: getApiHeaders(),
  });
  if (response.status === 401 || response.status === 404) return null;
  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }
  return (await response.json()) as ListingContact;
}

let cachedListings: PublicListing[] | null = null;
let cachedListingsAt = 0;
let cachePromise: Promise<PublicListing[]> | null = null;

/**
 * Public listings change rarely, so we cache them for the page session — but bound the
 * staleness so a long-open tab eventually reflects admin edits (e.g. a property's map
 * coordinates). A fresh navigation already re-fetches; this only matters for tabs left open.
 */
export const PUBLIC_LISTINGS_TTL_MS = 60_000;

/** Drop the cached public listings so the next fetch hits the network. */
export function invalidatePublicListingsCache(): void {
  cachedListings = null;
  cachedListingsAt = 0;
  cachePromise = null;
}

export const fetchPublicListings = async (signal?: AbortSignal): Promise<PublicListing[]> => {
  // Return cached result if still within the freshness window
  if (cachedListings != null && Date.now() - cachedListingsAt < PUBLIC_LISTINGS_TTL_MS) {
    return cachedListings;
  }

  // Return existing promise if already fetching
  if (cachePromise != null) {
    return cachePromise;
  }

  // Create new fetch promise
  cachePromise = (async () => {
    try {
      const response = await fetch(buildApiUrl(PUBLIC_LISTINGS_ENDPOINT), {
        signal,
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        throw new Error(await messageFromApiResponse(response));
      }

      const payload = (await response.json()) as unknown;
      const rows = coercePublicListingsPayload(payload);

      const result = rows
        .map((item) => normalizePublicListing(item))
        .filter((row): row is PublicListing => row !== null && row.id > 0);

      cachedListings = result;
      cachedListingsAt = Date.now();
      return result;
    } finally {
      cachePromise = null;
    }
  })();

  return cachePromise;
};

/** Normalize JSON from GET /listings/{propertyId}/photos into ordered URL strings. */
export function normalizeListingPhotoResponse(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    if (payload.length === 0) return [];
    if (payload.every((x): x is string => typeof x === 'string')) {
      return (payload as string[]).map((s) => s.trim()).filter(Boolean);
    }
    return payload
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim();
        if (entry && typeof entry === 'object') {
          const o = entry as Record<string, unknown>;
          const url =
            o.url ??
            o.photoUrl ??
            o.imageUrl ??
            o.src ??
            (typeof o.path === 'string' ? o.path : undefined);
          return typeof url === 'string' ? url.trim() : '';
        }
        return '';
      })
      .filter(Boolean);
  }
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    const nested = o.photos ?? o.items ?? o.urls ?? o.photoUrls ?? o.data ?? o.results;
    if (nested !== undefined) return normalizeListingPhotoResponse(nested);
  }
  return [];
}

/**
 * Same as {@link normalizeListingPhotoResponse}, but when the payload is an array of rows
 * with `listingId`, keep only one listing's rows ordered by `sortOrder`.
 */
export function normalizeListingPhotoResponseForListing(
  payload: unknown,
  listingId: number,
): string[] {
  if (!Number.isFinite(listingId) || listingId <= 0) return normalizeListingPhotoResponse(payload);
  const typed = parseListingPhotosResponse(payload);
  if (typed.length > 0) return listingPhotosToSortedUrls(typed, listingId);
  if (!Array.isArray(payload)) return normalizeListingPhotoResponse(payload);
  const rows = payload.filter(
    (e) =>
      e &&
      typeof e === 'object' &&
      Number((e as { listingId?: unknown }).listingId) === listingId,
  ) as Record<string, unknown>[];
  rows.sort(
    (a, b) => Number(a.sortOrder ?? a.SortOrder) - Number(b.sortOrder ?? b.SortOrder),
  );
  return normalizeListingPhotoResponse(rows);
}

/** Raw JSON from GET /listings/{propertyId}/photos (404 → `[]`). Throws on other HTTP errors. */
export async function fetchListingPhotosPayload(
  propertyId: number,
  signal?: AbortSignal,
): Promise<unknown> {
  if (!Number.isFinite(propertyId) || propertyId <= 0) return [];

  const response = await fetch(buildApiUrl(`${LISTING_ENDPOINT}/${propertyId}/photos`), {
    signal,
    headers: getApiHeaders(),
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  return response.json();
}

// Cache for property photos to prevent redundant API calls across hooks
const photosCachePromises = new Map<number, Promise<ListingPhoto[]>>();

/**
 * GET /listings/{propertyId}/photos — all photos for every listing on that property (typed).
 * Aligns with atlas-api: `feat(listings): GET /listings/{propertyId}/photos returns all units photos`.
 * Rows are ordered by `listingId` then `sortOrder` (same as API).
 * Results are cached to prevent redundant calls from multiple hooks.
 */
export async function fetchPropertyListingPhotos(
  propertyId: number,
  signal?: AbortSignal,
): Promise<ListingPhoto[]> {
  // Return cached promise if already fetching
  if (photosCachePromises.has(propertyId)) {
    return photosCachePromises.get(propertyId)!;
  }

  // Create and cache the fetch promise
  const promise = (async () => {
    try {
      const payload = await fetchListingPhotosPayload(propertyId, signal);
      const rows = parseListingPhotosResponse(payload);
      return rows.sort((a, b) => a.listingId - b.listingId || a.sortOrder - b.sortOrder);
    } finally {
      // Clean up cache after fetch completes
      photosCachePromises.delete(propertyId);
    }
  })();

  photosCachePromises.set(propertyId, promise);
  return promise;
}

/**
 * Guest catalog: GET /listings/{propertyId}/photos as URL strings.
 * Pass `listingId` to restrict to one unit when the property has multiple listings.
 * Falls back to {@link normalizeListingPhotoResponse} for legacy non-DTO payloads (e.g. string[]).
 */
export async function fetchListingPhotos(
  propertyId: number,
  signal?: AbortSignal,
  options?: { listingId?: number },
): Promise<string[]> {
  const payload = await fetchListingPhotosPayload(propertyId, signal);
  const typed = parseListingPhotosResponse(payload);
  if (typed.length > 0) {
    return listingPhotosToSortedUrls(typed, options?.listingId);
  }
  if (options?.listingId != null && options.listingId > 0) {
    return normalizeListingPhotoResponseForListing(payload, options.listingId);
  }
  return normalizeListingPhotoResponse(payload);
}

export const fetchListingById = async (
  listingId: string | number,
  signal?: AbortSignal,
): Promise<ListingDetail> => {
  const response = await fetch(buildApiUrl(`${LISTING_ENDPOINT}/${listingId}`), {
    signal,
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const normalized: ListingDetail = {
    ...payload,
    id: (payload.id ?? payload.listingId ?? listingId) as string | number,
    propertyId: (payload.propertyId ?? payload.property_id ?? payload.propertyID) as
      | string
      | number
      | undefined,
    name: (payload.name ?? payload.property_name ?? payload.title) as string | undefined,
  };

  return normalized;
};
