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
  /** TASK-1725: UTC ISO string when Atlas team verified listing photos. Null = not verified. */
  photosVerifiedAt?: string | null;
  /** TASK-1727: True when the tenant has a registered GSTIN — shown as trust badge on listing cards. */
  isGstRegistered?: boolean;
  /** TASK-1360: ISO date string of most recent checkout within 30 days, or null. */
  lastBookedAt?: string | null;
  /** TASK-1457: Property coordinates from API (null when unset). */
  latitude?: number | null;
  longitude?: number | null;
};

function normalizePublicListing(payload: Record<string, unknown>): PublicListing {
  const id = Number(payload.id);
  const maxGuests = Number(payload.maxGuests ?? 0);
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
    isGstRegistered: Boolean(payload.isGstRegistered), // TASK-1727
    lastBookedAt: typeof payload.lastBookedAt === 'string' ? payload.lastBookedAt : null, // TASK-1360
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
}

const coercePublicListingsPayload = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) {
    return payload.filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object');
  }
  if (payload && typeof payload === 'object') {
    const items = (payload as { items?: unknown }).items;
    if (Array.isArray(items)) {
      return items.filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object');
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

export const fetchPublicListings = async (signal?: AbortSignal): Promise<PublicListing[]> => {
  const response = await fetch(buildApiUrl(PUBLIC_LISTINGS_ENDPOINT), {
    signal,
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  const payload = (await response.json()) as unknown;
  const rows = coercePublicListingsPayload(payload);

  return rows
    .map((item) => normalizePublicListing(item))
    .filter((row): row is PublicListing => row !== null && row.id > 0);
};

/** Normalize JSON from GET /listings/:id/photos into ordered URL strings. */
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

/** Guest catalog: GET /listings/{listingId}/photos */
export async function fetchListingPhotos(
  listingId: number,
  signal?: AbortSignal,
): Promise<string[]> {
  if (!Number.isFinite(listingId) || listingId <= 0) return [];

  const response = await fetch(buildApiUrl(`${LISTING_ENDPOINT}/${listingId}/photos`), {
    signal,
    headers: getApiHeaders(),
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  const payload = (await response.json()) as unknown;
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
