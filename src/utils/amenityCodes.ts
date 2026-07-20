/**
 * TASK-2891 / TASK-2892: normalize API amenity codes for filters and card labels.
 * TASK-5195: category match is exact (normalized tokens + synonym map) — no substring includes.
 */

/** Human-readable label from a raw API / catalog code. Returns empty string for unrecognizable codes. */
export function formatAmenityName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  // Normalize separators → space, strip remaining punctuation, title-case each word.
  const normalized = trimmed
    .replace(/[_\-/\\|.,()[\]{}]+/g, ' ')
    .replace(/[^a-zA-Z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Strip separators so `air_conditioning` and `air-conditioning` share a token. */
export function normalizeAmenityToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_\-/\\|.,()[\]{}]+/g, '');
}

/** Filter-chip key → synonym tokens (already normalized where possible). */
const AMENITY_CATEGORY_SYNONYMS: Record<string, string[]> = {
  ac: ['ac', 'aircon', 'aircondition', 'airconditioning', 'airconditioner'],
  parking: ['parking', 'garage', 'carpark'],
  pool: ['pool', 'swimming', 'swimpool', 'swimmingpool'],
  wifi: ['wifi', 'wireless', 'internet', 'wlan'],
  'pet-friendly': ['pet', 'pets', 'dog', 'cat', 'petfriendly'],
  balcony: ['balcony', 'terrace', 'patio', 'deck', 'balconies'],
  workspace: ['workspace', 'workdesk', 'desk', 'study', 'workarea', 'coworking', 'workspace'],
};

const CATEGORY_TOKEN_SETS: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(AMENITY_CATEGORY_SYNONYMS).map(([k, syns]) => [
    k,
    new Set(syns.map(normalizeAmenityToken)),
  ]),
);

/** Whether a raw amenity code matches a search filter chip category (exact token / synonym only). */
export function amenityCodeMatchesCategory(rawCode: string, category: string): boolean {
  const token = normalizeAmenityToken(rawCode);
  if (!token) return false;
  const allowed = CATEGORY_TOKEN_SETS[category.toLowerCase()];
  if (!allowed || allowed.size === 0) return false;
  return allowed.has(token);
}

/** Resolve a display label for cards and chips. Returns null when the code is unrecognizable so callers can skip it. */
export function resolveAmenityLabel(rawCode: string): string | null {
  const label = formatAmenityName(rawCode);
  return label || null;
}
