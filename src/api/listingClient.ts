import { API_BASE_URL } from '@/config/api';

export type ListingDetail = {
  id: string | number;
  propertyId?: string | number;
  name?: string;
  [key: string]: unknown;
};

const LISTING_ENDPOINT = `${API_BASE_URL}/listings`;

export const fetchListingById = async (
  listingId: string | number,
  signal?: AbortSignal,
): Promise<ListingDetail> => {
  const response = await fetch(`${LISTING_ENDPOINT}/${listingId}`, { signal });

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
