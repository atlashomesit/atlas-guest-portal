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
  // TASK-10086: v1 step-free discovery trio. Exact canonical-code tokens only —
  // no free-text matching, so a missing declaration never implies accessibility.
  'step-free-entrance': ['stepfreeentrance'],
  'lift-access': ['elevator'],
  'accessible-parking': ['accessibleparking'],
};

/**
 * TASK-10086 [POD: Discovery/Search]: v1 step-free/accessible discovery vocabulary.
 * Three explicit host-declared amenity codes (canonical API spellings).
 * Absence of all three is the unknown state — never "accessible".
 */
export const ACCESSIBILITY_FEATURE_CODES = [
  'step_free_entrance',
  'elevator',
  'accessible_parking',
] as const;

export type AccessibilityFeatureCode = (typeof ACCESSIBILITY_FEATURE_CODES)[number];

/** Exact unknown-state copy for listing detail when no accessibility data is declared. */
export const ACCESSIBILITY_UNKNOWN_COPY = 'Not specified \u2014 ask host';

/** Search filter chip key → guest-facing label for the Accessibility needs group. */
export const ACCESSIBILITY_CHIP_LABELS: Record<string, string> = {
  'step-free-entrance': 'Step-free entrance',
  'lift-access': 'Lift/elevator access',
  'accessible-parking': 'Accessible parking',
};

/** Canonical API code → guest-facing label for listing detail. */
export const ACCESSIBILITY_CODE_LABELS: Record<string, string> = {
  step_free_entrance: 'Step-free entrance',
  elevator: 'Lift/elevator access',
  accessible_parking: 'Accessible parking',
};

/** Search filter chip keys for the Accessibility needs group, in display order. */
export const ACCESSIBILITY_CHIP_KEYS = Object.keys(ACCESSIBILITY_CHIP_LABELS);

const ACCESSIBILITY_CODE_SET = new Set(
  ACCESSIBILITY_FEATURE_CODES.map((c) => normalizeAmenityToken(c)),
);

/**
 * Return the canonical v1 codes explicitly present in `codes`.
 * Exact case-insensitive code match only — free-text values and neighbouring
 * codes (e.g. `wheelchair_accessible`, `parking_free`) are never inferred.
 */
export function getAccessibilityDeclarations(codes: readonly string[] | undefined | null): string[] {
  if (!codes) return [];
  const declared: string[] = [];
  const seen = new Set<string>();
  for (const raw of codes) {
    if (typeof raw !== 'string') continue;
    const token = normalizeAmenityToken(raw);
    if (!token || !ACCESSIBILITY_CODE_SET.has(token)) continue;
    const canonical = ACCESSIBILITY_FEATURE_CODES.find((c) => normalizeAmenityToken(c) === token)!;
    if (!seen.has(canonical)) {
      seen.add(canonical);
      declared.push(canonical);
    }
  }
  return declared;
}

/** True when none of the v1 accessibility features is declared (the unknown state). */
export function isAccessibilityUnknown(codes: readonly string[] | undefined | null): boolean {
  return getAccessibilityDeclarations(codes).length === 0;
}

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
