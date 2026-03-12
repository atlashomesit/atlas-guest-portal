import { buildApiUrl, getApiHeaders } from '@/api/client';

export type ListingDetail = {
  id: string | number;
  propertyId?: string | number;
  name?: string;
  [key: string]: unknown;
};

export type PublicListing = {
  id: number;
  propertyId: number;
  propertyName: string;
  propertyAddress?: string;
  name: string;
  floor: number;
  type: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: string;
  maxGuests: number;
  baseNightlyRate?: number;
  currency: string;
  coverPhotoUrl?: string;
  photoUrls: string[];
  timezoneId?: string;
};

const LISTING_ENDPOINT = '/listings';

export const fetchPublicListings = async (
  signal?: AbortSignal,
): Promise<PublicListing[]> => {
  const response = await fetch(buildApiUrl(`${LISTING_ENDPOINT}/public`), {
    signal,
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Public listings request failed with status ${response.status}`);
  }

  return (await response.json()) as PublicListing[];
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
