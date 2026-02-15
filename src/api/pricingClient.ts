import { buildApiUrl, getApiHeaders } from '@/api/client';

export type PricingBreakdown = {
  baseAmount?: number;
  discountAmount?: number;
  convenienceFeeAmount?: number;
  finalAmount?: number;
  BaseAmount?: number;
  DiscountAmount?: number;
  ConvenienceFeeAmount?: number;
  FinalAmount?: number;
};

export type PricingBreakdownParams = {
  listingId: string | number;
  checkIn: string;
  checkOut: string;
};

const BREAKDOWN_ENDPOINT = '/pricing/breakdown';

export async function fetchPricingBreakdown(
  params: PricingBreakdownParams,
  signal?: AbortSignal,
): Promise<PricingBreakdown> {
  const url = new URL(buildApiUrl(BREAKDOWN_ENDPOINT));
  url.searchParams.set('listingId', String(params.listingId));
  url.searchParams.set('checkIn', params.checkIn);
  url.searchParams.set('checkOut', params.checkOut);

  const response = await fetch(url.toString(), { signal, headers: getApiHeaders() });

  if (!response.ok) {
    throw new Error(`Pricing breakdown failed with status ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return data as PricingBreakdown;
}
