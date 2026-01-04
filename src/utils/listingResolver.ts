import type { ListingDetail } from '../api/listingClient';

const LISTING_ENDPOINT =
  'https://atlas-homes-api-gxdqfjc2btc0atbv.centralus-01.azurewebsites.net/listings';

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
  const response = await fetch(`${LISTING_ENDPOINT}/${encodeURIComponent(param)}`, { signal });

  if (response.ok) {
    const payload = (await response.json()) as Record<string, unknown>;
    return normalizeListingPayload(payload, param);
  }

  if (response.status !== 404) {
    throw new Error(`Listing request failed with status ${response.status}`);
  }

  if (import.meta.env.DEV) {
    console.debug('[resolveListing] 404 fallback triggered for', param);
  }

  const listResponse = await fetch(LISTING_ENDPOINT, { signal });

  if (!listResponse.ok) {
    throw new Error(`Listing request failed with status ${listResponse.status}`);
  }

  const listPayload = (await listResponse.json()) as unknown;

  if (!Array.isArray(listPayload)) {
    throw new Error('Listing response did not return an array');
  }

  const normalizedParam = normalizeMatchValue(param);
  const atlasParam = `atlas${normalizedParam}`;
  const match = listPayload.find((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const payload = entry as Record<string, unknown>;
    const name =
      (payload.name ?? payload.property_name ?? payload.title ?? payload.listingName) as
        | string
        | undefined;
    if (!name) return false;
    const normalizedName = normalizeMatchValue(name);
    return normalizedName === normalizedParam || normalizedName === atlasParam;
  }) as Record<string, unknown> | undefined;

  const resolved = match ? normalizeListingPayload(match, param) : null;

  if (import.meta.env.DEV) {
    console.debug('[resolveListing] match result', resolved);
  }

  return resolved;
};
