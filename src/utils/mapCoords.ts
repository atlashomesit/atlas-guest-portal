/** TASK-1457: Hyderabad centroid for deterministic fallback pins when API has no coordinates. */
export const HYDERABAD_CENTER = { lat: 17.385044, lng: 78.486671 };

/** Stable pseudo-jitter from listing id so pins do not stack. */
export function fallbackCoordsForListing(numericId: number): { lat: number; lng: number } {
  const seed = Math.abs(numericId) * 9301 + 49297;
  const r1 = ((seed % 1000) / 1000 - 0.5) * 0.08;
  const r2 = (((seed / 1000) | 0) % 1000) / 1000 - 0.5;
  const r2s = r2 * 0.08;
  return { lat: HYDERABAD_CENTER.lat + r1, lng: HYDERABAD_CENTER.lng + r2s };
}

export function hasMapCoords(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}
