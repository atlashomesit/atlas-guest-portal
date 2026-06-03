/**
 * TASK-2891 / TASK-2892: normalize API amenity codes for filters and card labels.
 */

/** Human-readable label from a raw API / catalog code. */
export function formatAmenityName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Amenity';
  if (/^[A-Z0-9_]+$/.test(trimmed)) {
    return trimmed
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Filter-chip key → tokens that may appear in API `amenityCodes` / `amenities_icon`. */
const AMENITY_CATEGORY_TOKENS: Record<string, string[]> = {
  ac: ['ac', 'aircon', 'air_condition', 'air-conditioning', 'air conditioning', 'airconditioner'],
  parking: ['parking', 'garage', 'car_park', 'carpark'],
  pool: ['pool', 'swimming', 'swim_pool', 'swimming_pool'],
  wifi: ['wifi', 'wi_fi', 'wireless', 'internet', 'wlan'],
  'pet-friendly': ['pet', 'pets', 'dog', 'cat', 'pet_friendly', 'pet-friendly'],
  balcony: ['balcony', 'terrace', 'patio', 'deck', 'balconies'],
};

/** Whether a raw amenity code matches a search filter chip category. */
export function amenityCodeMatchesCategory(rawCode: string, category: string): boolean {
  const code = rawCode.trim().toLowerCase();
  if (!code) return false;
  const tokens = AMENITY_CATEGORY_TOKENS[category.toLowerCase()] ?? [];
  return tokens.some((t) => code === t || code.includes(t) || t.includes(code));
}

/** Resolve a display label for cards and chips. */
export function resolveAmenityLabel(rawCode: string): string {
  return formatAmenityName(rawCode);
}
