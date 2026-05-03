import type { ListingDetail } from '../api/listingClient';
import { buildApiUrl, getApiHeaders } from '@/api/client';
import { messageFromApiResponse } from '@/utils/serverErrorFromResponse';

const normalizeListingPayload = (
  payload: Record<string, unknown>,
  fallbackId: string,
): ListingDetail => ({
  ...payload,
  id: (payload.id ?? payload.listingId ?? fallbackId) as string | number,
  propertyId: (payload.propertyId ?? payload.property_id ?? payload.propertyID) as
    | string
    | number
    | undefined,
  name: (payload.name ?? payload.property_name ?? payload.title) as string | undefined,
});

const normalizeMatchValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

/** Names shorter than this must not use "param includes name" matching (TASK-1185: "in"/"id" inside "invalid-…"). */
const MIN_NORMALIZED_NAME_LEN_FOR_PARAM_INCLUDES = 8;

const coercePublicListingsArray = (payload: unknown): Record<string, unknown>[] => {
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

const isAbortLikeError = (error: unknown, signal?: AbortSignal) => {
  if (signal?.aborted === true) {
    return true;
  }

  if (!error || typeof error !== 'object') {
    return false;
  }

  const name = (error as { name?: string }).name;
  if (name === 'AbortError') {
    return true;
  }

  const message = (error as { message?: string }).message;
  if (typeof message === 'string' && message.toLowerCase().includes('aborted')) {
    return true;
  }

  return false;
};
export const resolveListing = async (
  param: string,
  signal?: AbortSignal,
): Promise<ListingDetail | null> => {
  const headers = getApiHeaders();

  const attemptResolveListing = async (): Promise<{
    listing: ListingDetail | null;
    error?: Error;
  }> => {
    const singleListingUrl = buildApiUrl(`/listings/${encodeURIComponent(param)}`);
    try {
      const response = await fetch(singleListingUrl, { signal, headers });
      if (response.ok) {
        const payload = (await response.json()) as Record<string, unknown>;
        return { listing: normalizeListingPayload(payload, param) };
      }

      if (response.status !== 404) {
        const msg = await messageFromApiResponse(response);
        console.error(`[resolveListing] API Error (${response.status}):`, msg);
        return { listing: null, error: new Error(msg) };
      }
    } catch (error) {
      if (isAbortLikeError(error, signal)) {
        return { listing: null };
      }
      console.error('[resolveListing] Error during direct lookup:', error);
      return { listing: null, error: error as Error };
    }

    const listEndpoint = buildApiUrl('/listings/public');
    try {
      const listResponse = await fetch(listEndpoint, { signal, headers });

      if (!listResponse.ok) {
        const msg = await messageFromApiResponse(listResponse);
        console.error('[resolveListing] Failed to fetch public listings:', msg);
        return {
          listing: null,
          error: new Error(msg),
        };
      }

      const listPayload = (await listResponse.json()) as unknown;
      const listingRows = coercePublicListingsArray(listPayload);

      const normalizedParam = normalizeMatchValue(param);
      const atlasParam = `atlas${normalizedParam}`;
      const paramIsAllDigits = /^\d+$/.test(normalizedParam);
      const allowLooseNameIncludesParam =
        normalizedParam.length >= 4 || paramIsAllDigits;

      // Try to find a match using different strategies
      const match = listingRows.find((entry) => {
        const payload = entry;
        const name = (payload.name ?? payload.property_name ?? payload.title ?? payload.listingName) as
          | string
          | undefined;

        if (!name) return false;

        const normalizedName = normalizeMatchValue(name);

        // Try different matching strategies:
        // 1. Exact match with the provided param
        if (normalizedName === normalizedParam) return true;

        // 2. Match with "atlas" prefix
        if (normalizedName === atlasParam) return true;

        // 3. Match when param is a substring of the name (e.g., "501" matches "Atlas501_PH")
        if (allowLooseNameIncludesParam && normalizedName.includes(normalizedParam)) return true;

        // 4. Match when name is a substring of the param (strict min length — avoids "in"/"id" in "invalid-…")
        if (
          normalizedName.length >= MIN_NORMALIZED_NAME_LEN_FOR_PARAM_INCLUDES &&
          normalizedParam.includes(normalizedName)
        ) {
          return true;
        }

        return false;
      }) as Record<string, unknown> | undefined;

      const resolved = match ? normalizeListingPayload(match, param) : null;

      return { listing: resolved };
    } catch (error) {
      if (isAbortLikeError(error, signal)) {
        return { listing: null };
      }
      console.error('[resolveListing] Error during listing search:', error);
      return { listing: null, error: error as Error };
    }
  };

  const primaryResult = await attemptResolveListing();
  if (primaryResult.error) {
    throw primaryResult.error;
  }

  return primaryResult.listing;
};
