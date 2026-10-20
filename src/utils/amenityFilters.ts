import { amenityCodeMatchesCategory, normalizeAmenityToken } from './amenityCodes';

export type AmenityFilterPillItem = {
  label: string;
  icon: string;
  categoryKey?: string;
};

export const DEFAULT_MARKETPLACE_AMENITY_PILLS: AmenityFilterPillItem[] = [
  { label: 'Pool', icon: '🏊', categoryKey: 'pool' },
  { label: 'Pet Friendly', icon: '🐾', categoryKey: 'pet-friendly' },
  { label: 'Beachfront', icon: '🏖️', categoryKey: 'beachfront' },
  { label: 'Mountain View', icon: '🏔️', categoryKey: 'mountain-view' },
];

export type ListingWithAmenities = {
  title?: string | null;
  slug?: string | null;
  city?: string | null;
  description?: string | null;
  amenityCodes?: (string | null | undefined)[] | null;
  amenities?: (string | { code?: string | null; name?: string | null; title?: string | null } | null | undefined)[] | null;
};

/**
 * TASK-10298932: Robust amenity filtering for marketplace listings.
 * Checks:
 * 1. Explicit `amenityCodes` array if available on the listing
 * 2. `amenities` array of codes/objects if available
 * 3. Text fallback across title, slug, city, and description
 *
 * Ensures valid matches are never dropped just because the property title omits the amenity word,
 * while safely falling back when amenity codes are omitted by the DTO.
 */
export function matchesAmenityFilter(
  item: ListingWithAmenities,
  selectedAmenity: string | null,
): boolean {
  if (!selectedAmenity) return true;

  const term = selectedAmenity.trim().toLowerCase();
  const categoryKey = term.replace(/\s+/g, '-');
  const normTerm = normalizeAmenityToken(term);

  // 1. Check explicit amenityCodes if present
  if (Array.isArray(item.amenityCodes) && item.amenityCodes.length > 0) {
    const hasCodeMatch = item.amenityCodes.some((code) => {
      if (!code || typeof code !== 'string') return false;
      if (amenityCodeMatchesCategory(code, term) || amenityCodeMatchesCategory(code, categoryKey)) {
        return true;
      }
      const normCode = normalizeAmenityToken(code);
      if (normCode && (normCode.includes(normTerm) || normTerm.includes(normCode))) {
        return true;
      }
      // Common code mappings
      if (categoryKey === 'pool' && (normCode.includes('pool') || normCode.includes('swim'))) return true;
      if (categoryKey === 'pet-friendly' && (normCode.includes('pet') || normCode.includes('dog') || normCode.includes('cat'))) return true;
      if (categoryKey === 'beachfront' && (normCode.includes('beach') || normCode.includes('ocean') || normCode.includes('sea'))) return true;
      if (categoryKey === 'mountain-view' && (normCode.includes('mountain') || normCode.includes('hill') || normCode.includes('valley'))) return true;
      return false;
    });
    if (hasCodeMatch) return true;
  }

  // 2. Check explicit amenities object list if present
  if (Array.isArray(item.amenities) && item.amenities.length > 0) {
    const hasAmenityMatch = item.amenities.some((a) => {
      if (!a) return false;
      const raw = typeof a === 'string' ? a : (a.code || a.name || a.title || '');
      if (!raw) return false;
      if (amenityCodeMatchesCategory(raw, term) || amenityCodeMatchesCategory(raw, categoryKey)) {
        return true;
      }
      const norm = normalizeAmenityToken(raw);
      if (norm && (norm.includes(normTerm) || normTerm.includes(norm))) {
        return true;
      }
      if (categoryKey === 'pool' && (norm.includes('pool') || norm.includes('swim'))) return true;
      if (categoryKey === 'pet-friendly' && (norm.includes('pet') || norm.includes('dog') || norm.includes('cat'))) return true;
      if (categoryKey === 'beachfront' && (norm.includes('beach') || norm.includes('ocean') || norm.includes('sea'))) return true;
      if (categoryKey === 'mountain-view' && (norm.includes('mountain') || norm.includes('hill') || norm.includes('valley'))) return true;
      return false;
    });
    if (hasAmenityMatch) return true;
  }

  // 3. Fallback to title, slug, city, description substring matching
  const text = `${item.title ?? ''} ${item.slug ?? ''} ${item.city ?? ''} ${item.description ?? ''}`.toLowerCase();
  if (categoryKey === 'pool' || term === 'pool') {
    return text.includes('pool') || text.includes('swimming');
  }
  if (categoryKey === 'pet-friendly' || term === 'pet friendly') {
    return text.includes('pet') || text.includes('dog');
  }
  if (categoryKey === 'beachfront' || term === 'beachfront') {
    return text.includes('beach') || text.includes('sea') || text.includes('ocean');
  }
  if (categoryKey === 'mountain-view' || term === 'mountain view') {
    return text.includes('mountain') || text.includes('hill') || text.includes('valley');
  }

  return text.includes(term);
}
