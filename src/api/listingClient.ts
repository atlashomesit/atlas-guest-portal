import { buildApiUrl, getApiHeaders } from '@/api/client';

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
};

function normalizePublicListing(payload: Record<string, unknown>): PublicListing {
  const id = Number(payload.id);
  const maxGuests = Number(payload.maxGuests ?? 0);
  const rawRate = payload.baseNightlyRate;
  const photos = payload.photoUrls;
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
  };
}

export const fetchPublicListings = async (signal?: AbortSignal): Promise<PublicListing[]> => {
  const response = await fetch(buildApiUrl(PUBLIC_LISTINGS_ENDPOINT), {
    signal,
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Public listings request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) =>
      item && typeof item === 'object'
        ? normalizePublicListing(item as Record<string, unknown>)
        : null,
    )
    .filter((row): row is PublicListing => row !== null && row.id > 0);
};

export const fetchListingById = async (
  listingId: string | number,
  signal?: AbortSignal,
): Promise<ListingDetail> => {
  const response = await fetch(buildApiUrl(`${LISTING_ENDPOINT}/${listingId}`), {
    signal,
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Listing request failed with status ${response.status}`);
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
