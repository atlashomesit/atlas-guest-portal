/**
 * GUEST-061: the cities a tenant's homes are really in, built from the listings themselves, so a host with homes
 * in several cities is never told every home is in the one city on their legal address.
 */
const MAX_CITIES_NAMED = 6;

/** Distinct cities (case-insensitive), most homes first, ties in first-seen order. */
export function collectListingCities(items: ReadonlyArray<{ city?: string | null } | null | undefined>): string[] {
  const counts = new Map<string, { label: string; count: number; order: number }>();
  let order = 0;
  for (const item of items) {
    const label = typeof item?.city === 'string' ? item.city.trim() : '';
    if (!label) continue;
    const key = label.toLowerCase();
    const hit = counts.get(key);
    if (hit) hit.count += 1;
    else counts.set(key, { label, count: 1, order: order++ });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .map((c) => c.label);
}

/** "Udaipur", "Udaipur and Goa", "Udaipur, Goa and Coorg"; more than six becomes "7 cities". Null when none. */
export function formatCityList(cities: readonly string[]): string | null {
  if (cities.length === 0) return null;
  if (cities.length === 1) return cities[0];
  if (cities.length > MAX_CITIES_NAMED) return `${cities.length} cities`;
  return `${cities.slice(0, -1).join(', ')} and ${cities[cities.length - 1]}`;
}

/**
 * The place phrase for headlines: the listings' own cities when any listing names one, otherwise the
 * fallback (the tenant's legal-address city), otherwise null.
 */
export function resolveHomesPlace(
  items: ReadonlyArray<{ city?: string | null } | null | undefined>,
  fallbackCity?: string | null,
): string | null {
  const fromListings = formatCityList(collectListingCities(items));
  if (fromListings) return fromListings;
  const fallback = (fallbackCity ?? '').trim();
  return fallback || null;
}
