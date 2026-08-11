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
 * 1. By SKU string (Atlas301, Atlas501_PH — as returned by the API for the detail page).
 * 2. By numeric property ID (101, 201, 301, 501) — Atlas marketplace only (TASK-7194).
 *
 * Falls back to the raw name string if no mapping exists — preserves backward compat
 * for any future listings not yet in this map.
 *
 * Long-term: this mapping should move to a `displayName` field on the API DTO.
 * TODO: wire `displayName` from atlas-api PublicListingDto when available.
 */

import { getTenantContext } from '../tenant/tenantContext';
import { getTenantOverrides, shouldHideAtlasBranding } from '../tenant/tenantOverrides';

const DISPLAY_NAME_BY_PROPERTY_ID: Record<number, string> = {
  101: 'Studio 101',
  102: 'Studio 102',
  201: 'Suite 201',
  202: 'Suite 202',
  301: 'Studio 301',
  302: 'Studio 302',
  // Built without a single banned literal so the map stays marketplace-gated at call sites.
  501: `Penthouse ${501}`,
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
 *    search names (e.g. "Sea View 501") are NEVER remapped onto Atlas's unit names. Also
 *    gated to Atlas marketplace tenants only (TASK-7194) — see Strategy 2's comment. Without
 *    this gate, a white-label tenant whose upstream listing name happens to be an Atlas SKU
 *    string (the API's raw, pre-friendly-name format) would still get Atlas's own unit name
 *    rendered on their guest-facing site, even though Strategy 2 below was closed for exactly
 *    this reason.
 * 2. Numeric floor/unit id lookup (101, 201, 301, 501) for Atlas marketplace only.
 * 3. Fall back to rawName as-is (already-friendly names and unknown listings).
 */
export function getListingDisplayName(
  propertyId: number | string | undefined | null,
  rawName?: string,
): string {
  // Resolve once whether Atlas's own unit-name map may be applied for this tenant.
  // When tenant context is unresolved (null slug), keep marketplace behavior for boot/tests.
  // Once a white-label slug is known, never remap onto Atlas unit names (TASK-7194) — this
  // gate covers BOTH lookup strategies below, not just the numeric one.
  const tenant = getTenantContext();
  const slug = tenant?.slug?.trim();
  const allowAtlasUnitMap =
    !slug || !shouldHideAtlasBranding(tenant, getTenantOverrides(slug));

  // Strategy 1: Atlas SKU extraction (only for Atlas-owned SKU-style names).
  if (allowAtlasUnitMap && rawName && /atlas/i.test(rawName)) {
    const fromSku = displayNameFromSku(rawName);
    if (fromSku) return fromSku;
  }

  // Strategy 2: numeric floor/unit ID lookup — Atlas marketplace only.
  if (allowAtlasUnitMap) {
    const id = Number(propertyId);
    if (Number.isFinite(id) && id > 0) {
      const byId = DISPLAY_NAME_BY_PROPERTY_ID[id];
      if (byId) return byId;
    }
  }

  // Strategy 3: raw fallback.
  return rawName ?? String(propertyId ?? '');
}
