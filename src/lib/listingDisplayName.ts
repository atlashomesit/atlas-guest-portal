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
 * TASK-2635: the displayed name must be STABLE for a given listing across renders of the
 * same URL. The upstream `name` field arrives sometimes as the raw SKU ("Atlas501_PH") and
 * sometimes already-friendly ("Penthouse 501"), and callers pass an `id` arg that is not
 * always a floor number — so an id-first lookup made the result depend on volatile inputs
 * (it flipped between "Atlas501_PH" and "Penthouse 501" on prod). Resolve the Atlas SKU
 * FIRST so both SKU and friendly inputs collapse to the same friendly name regardless of
 * the id arg.
 *
 * Priority:
 * 1. Atlas SKU → friendly. Gated to names containing "atlas" so cross-tenant marketplace /
 *    search names (e.g. "Sea View 501") are NEVER remapped onto Atlas's unit names.
 * 2. Numeric floor/unit id lookup (101, 201, 301, 501) for callers that pass a real number.
 * 3. Fall back to rawName as-is (already-friendly names and unknown listings).
 */
export function getListingDisplayName(
  propertyId: number | string | undefined | null,
  rawName?: string,
): string {
  // Strategy 1: Atlas SKU extraction (only for Atlas-owned SKU-style names).
  if (rawName && /atlas/i.test(rawName)) {
    const fromSku = displayNameFromSku(rawName);
    if (fromSku) return fromSku;
  }

  // Strategy 2: numeric property/floor ID lookup.
  const id = Number(propertyId);
  if (Number.isFinite(id) && id > 0) {
    const byId = DISPLAY_NAME_BY_PROPERTY_ID[id];
    if (byId) return byId;
  }

  // Strategy 3: raw fallback.
  return rawName ?? String(propertyId ?? '');
}
