/** TASK-1457: Hyderabad centroid for deterministic fallback pins when API has no coordinates. */
export const HYDERABAD_CENTER = { lat: 17.385044, lng: 78.486671 };

/**
 * TASK-102490: city centroids for coordinate-less listings. Investigation result
 * (done-when 1): the search/property maps read LISTING-level latitude/longitude from
 * the public listings API DTO (SearchPage.tsx apiToNormalized ← `l.latitude`), NOT the
 * tenant Location pin — so tenant-level granularity was never the defect here. The
 * defect was this fallback: every coordinate-less listing rendered a jittered pin
 * around Hyderabad regardless of its real city.
 */
const CITY_CENTROIDS: ReadonlyArray<{ match: RegExp; lat: number; lng: number }> = [
  { match: /\b(hyderabad|secunderabad)\b/i, lat: 17.385044, lng: 78.486671 },
  { match: /\bgoa\b/i, lat: 15.299326, lng: 74.123996 },
  { match: /\b(bengaluru|bangalore)\b/i, lat: 12.971599, lng: 77.594566 },
  { match: /\b(coorg|madikeri|kodagu)\b/i, lat: 12.424422, lng: 75.738185 },
  { match: /\budaipur\b/i, lat: 24.585445, lng: 73.712479 },
];

/** Stable pseudo-jitter from listing id so pins do not stack. */
function jitter(numericId: number): { dLat: number; dLng: number } {
  const seed = Math.abs(numericId) * 9301 + 49297;
  const r1 = ((seed % 1000) / 1000 - 0.5) * 0.08;
  const r2 = (((seed / 1000) | 0) % 1000) / 1000 - 0.5;
  return { dLat: r1, dLng: r2 * 0.08 };
}

export function centroidForCity(city: string | null | undefined): { lat: number; lng: number } | null {
  if (!city || !city.trim()) return null;
  const found = CITY_CENTROIDS.find((c) => c.match.test(city));
  return found ? { lat: found.lat, lng: found.lng } : null;
}

/**
 * Coordinate fallback for a listing the API returned without lat/lng.
 * Returns the listing's own city centroid (+ deterministic jitter) when the city
 * is recognised, else null — callers must SKIP the pin rather than render a fake
 * Hyderabad pin for a non-Hyderabad listing.
 */
export function fallbackCoordsForListing(
  numericId: number,
  city?: string | null,
): { lat: number; lng: number } | null {
  const center = centroidForCity(city);
  if (!center) return null;
  const j = jitter(numericId);
  return { lat: center.lat + j.dLat, lng: center.lng + j.dLng };
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
