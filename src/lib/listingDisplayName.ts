/**
 * SKU → human display name mapping.
 *
 * The Atlas API returns raw SKU strings for listing names (e.g. "Atlas301", "Atlas501_PH").
 * These are correct for backend routing but not suitable for guest-facing UI.
 *
 * This module maps to human display names shown in the brief:
 * Penthouse 501, Studio 301/302, Suite 201/202, Studio 101/102.
 *
 * Two lookup strategies:
 * 1. By numeric property ID (101, 201, 301, 501 — the stable floor/unit numbers used in
 *    propertyData.ts and HomePage_Locations.tsx).
 * 2. By SKU string (Atlas301, Atlas501_PH — as returned by the API for the detail page).
 *
 * Falls back to the raw name string if no mapping exists — preserves backward compat
 * for any future listings not yet in this map.
 *
 * Long-term: this mapping should move to a `displayName` field on the API DTO.
 * TODO: wire `displayName` from atlas-api PublicListingDto when available.
 */

const DISPLAY_NAME_BY_PROPERTY_ID: Record<number, string> = {
  101: 'Studio 101',
  102: 'Studio 102',
  201: 'Suite 201',
  202: 'Suite 202',
  301: 'Studio 301',
  302: 'Studio 302',
  501: 'Penthouse 501',
};

/** Normalise a SKU like "Atlas501_PH" or "atlas301" → try to extract the number and map it. */
function displayNameFromSku(sku: string): string | null {
  // Extract the first 2-3 digit number from the SKU (101, 201, 301, 501, etc.)
  const match = sku.match(/(\d{2,4})/);
  if (!match) return null;
  const n = Number(match[1]);
  return DISPLAY_NAME_BY_PROPERTY_ID[n] ?? null;
}

/**
 * Returns the human display name for a listing.
 *
 * Priority:
 * 1. Look up by numeric propertyId (101, 201, 301, 501).
 * 2. If propertyId not found, try to extract a number from rawName (SKU).
 * 3. Fall back to rawName as-is.
 */
export function getListingDisplayName(
  propertyId: number | string | undefined | null,
  rawName?: string,
): string {
  // Strategy 1: numeric property ID lookup
  const id = Number(propertyId);
  if (Number.isFinite(id) && id > 0) {
    const byId = DISPLAY_NAME_BY_PROPERTY_ID[id];
    if (byId) return byId;
  }

  // Strategy 2: SKU string extraction from rawName
  if (rawName) {
    const fromSku = displayNameFromSku(rawName);
    if (fromSku) return fromSku;
  }

  // Strategy 3: raw fallback
  return rawName ?? String(propertyId ?? '');
}
