/**
 * Decides which map to render on a property-detail page.
 *
 * Precedence (Task 3 fix): the property's OWN coordinates win, because that is the
 * value an admin just edited and expects to see. Only when the property has no
 * coordinates do we fall back to a host-pasted custom embed, then the all-properties
 * multi-pin map, then the tenant-level default location.
 *
 *   own coords  >  custom mapSrc iframe  >  multi-pin  >  tenant default  >  none
 */
export type PropertyMapSelection =
  | { kind: "coords"; lat: number; lng: number }
  | { kind: "iframe" }
  | { kind: "multipin" }
  | { kind: "tenant"; lat: number; lng: number }
  | { kind: "none" };

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function selectPropertyMapMode(args: {
  latitude?: unknown;
  longitude?: unknown;
  mapSrc?: string | null;
  useMultiPin?: boolean;
  mapLocation?: { lat?: unknown; lng?: unknown } | null;
}): PropertyMapSelection {
  const { latitude, longitude, mapSrc, useMultiPin, mapLocation } = args;

  // 1. Property's own coordinates — the source of truth for its own detail page.
  if (isFiniteNum(latitude) && isFiniteNum(longitude)) {
    return { kind: "coords", lat: latitude, lng: longitude };
  }
  // 2. Host-provided custom embed, only when the property has no structured coords.
  if (typeof mapSrc === "string" && mapSrc.trim().length > 0) {
    return { kind: "iframe" };
  }
  // 3. All-properties multi-pin map (tenant has >=2 geocoded properties).
  if (useMultiPin) {
    return { kind: "multipin" };
  }
  // 4. Tenant-level default location (last resort).
  if (mapLocation && isFiniteNum(mapLocation.lat) && isFiniteNum(mapLocation.lng)) {
    return { kind: "tenant", lat: mapLocation.lat, lng: mapLocation.lng };
  }
  return { kind: "none" };
}
