import type { ListingDetail } from '../api/listingClient';
import getApiBaseUrl from './apiBaseUrl';
import { assertNonEmpty } from './requiredValues';

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
export const resolveListing = async (
  param: string,
  signal?: AbortSignal,
): Promise<ListingDetail | null> => {
  const apiBaseUrl = assertNonEmpty(getApiBaseUrl(), "VITE_API_BASE_URL");

  if (!apiBaseUrl) {
    const runtimeValue =
      typeof window !== "undefined"
        ? (window as any).__ATLAS_RUNTIME_CONFIG__?.apiBaseUrl
        : undefined;
    const envValue =
      typeof import.meta !== "undefined"
        ? (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL
        : undefined;
    const runtimeLog = runtimeValue?.toString().trim() || "(empty)";
    const envLog = envValue?.toString().trim() || "(empty)";
    console.error(
      `[resolveListing] Missing API base URL; runtime: ${runtimeLog}; env: ${envLog}.`,
    );
  }

  const attemptResolveListing = async (
    baseUrl: string,
  ): Promise<{ listing: ListingDetail | null; error?: Error }> => {
    const trimmedBaseUrl = baseUrl.replace(/\/$/, "");
    const listingEndpoint = trimmedBaseUrl ? `${trimmedBaseUrl}/listings` : "/listings";
    const url = `${listingEndpoint}/${encodeURIComponent(param)}`;
    console.log(`[resolveListing] Fetching from: ${url}`);

    try {
      const response = await fetch(url, { signal });
      console.log(`[resolveListing] Response status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const payload = (await response.json()) as Record<string, unknown>;
        console.log('[resolveListing] Successfully retrieved listing:', payload);
        return { listing: normalizeListingPayload(payload, param) };
      }

      if (response.status !== 404) {
        const errorText = await response.text().catch(() => 'No error details');
        console.error(`[resolveListing] API Error (${response.status}):`, errorText);
        return { listing: null, error: new Error(`Listing request failed with status ${response.status}: ${errorText}`) };
      }
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        return { listing: null };
      }
      console.error('[resolveListing] Error during direct lookup:', error);
      return { listing: null, error: error as Error };
    }

    if (import.meta.env.DEV) {
      console.debug('[resolveListing] 404 fallback triggered for', param);
    }

    // Fallback to fetching all listings for client-side search
    console.log('[resolveListing] Fetching all listings...');
    try {
      const listResponse = await fetch(listingEndpoint, { signal });

      if (!listResponse.ok) {
        const errorText = await listResponse.text().catch(() => 'No error details');
        console.error('[resolveListing] Failed to fetch all listings:', errorText);
        return {
          listing: null,
          error: new Error(`Failed to fetch listings: ${listResponse.status} ${errorText}`),
        };
      }

      const listPayload = (await listResponse.json()) as unknown;

      if (!Array.isArray(listPayload)) {
        return { listing: null, error: new Error('Listing response did not return an array') };
      }

      const normalizedParam = normalizeMatchValue(param);
      const atlasParam = `atlas${normalizedParam}`;

      // Try to find a match using different strategies
      const match = listPayload.find((entry) => {
        if (!entry || typeof entry !== 'object') return false;

        const payload = entry as Record<string, unknown>;
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
        if (normalizedName.includes(normalizedParam)) return true;

        // 4. Match when name is a substring of the param
        if (normalizedParam.includes(normalizedName)) return true;

        return false;
      }) as Record<string, unknown> | undefined;

      const resolved = match ? normalizeListingPayload(match, param) : null;

      if (import.meta.env.DEV) {
        console.debug('[resolveListing] match result', resolved);
      }

      return { listing: resolved };
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        return { listing: null };
      }
      console.error('[resolveListing] Error during listing search:', error);
      return { listing: null, error: error as Error };
    }
  };

  const primaryBaseUrl = apiBaseUrl ?? "";
  const primaryResult = await attemptResolveListing(primaryBaseUrl);
  if (!primaryResult.error) {
    return primaryResult.listing;
  }

  if (!apiBaseUrl) {
    throw primaryResult.error;
  }

  console.warn('[resolveListing] Primary listing lookup failed; retrying with same-origin requests.');
  const fallbackResult = await attemptResolveListing("");
  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return fallbackResult.listing;
};
