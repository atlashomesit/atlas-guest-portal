import { buildApiUrl, getApiHeaders } from '@/api/client';
import { messageFromApiResponse } from '@/utils/serverErrorFromResponse';

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
  url.searchParams.set('from', checkIn);
  url.searchParams.set('to', checkOut);
  url.searchParams.set('guests', String(guests));

  const response = await fetch(url.toString(), { signal, headers: getApiHeaders() });

  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  return (await response.json()) as AvailabilityResponse;
};
