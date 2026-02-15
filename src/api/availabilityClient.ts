import { buildApiUrl, getApiHeaders } from '@/api/client';

export type AvailabilityNightlyRate = {
  date: string;
  isAvailable: boolean;
};

export type AvailabilityListing = {
  propertyId?: string | number;
  listingId?: string | number;
  id?: string | number;
  nightlyRates: AvailabilityNightlyRate[];
};

export type AvailabilityResponse = {
  listings?: AvailabilityListing[];
  nightlyRates?: AvailabilityNightlyRate[];
};

export type AvailabilityRequestParams = {
  propertyId: string | number;
  checkIn: string;
  checkOut: string;
  guests: number;
  signal?: AbortSignal;
};

const AVAILABILITY_ENDPOINT = '/availability';

export const fetchAvailability = async ({
  propertyId,
  checkIn,
  checkOut,
  guests,
  signal,
}: AvailabilityRequestParams): Promise<AvailabilityResponse> => {
  const url = new URL(buildApiUrl(AVAILABILITY_ENDPOINT));
  url.searchParams.set('propertyId', String(propertyId));
  url.searchParams.set('checkIn', checkIn);
  url.searchParams.set('checkOut', checkOut);
  url.searchParams.set('guests', String(guests));

  const response = await fetch(url.toString(), { signal, headers: getApiHeaders() });

  if (!response.ok) {
    throw new Error(`Availability request failed with status ${response.status}`);
  }

  return (await response.json()) as AvailabilityResponse;
};
