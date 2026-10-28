import { repairMojibake } from './textUtils';

/**
 * Resolves the "About this home" copy for the listing page.
 *
 * Requirement: show the description the host entered in the admin portal under
 * Rooms & prices → Listing details — the "Full description" (`longDescription`), falling back to
 * the "Short description" (`shortDescription`) when only that one is filled in.
 *
 * Only GET /listings/{id} carries these fields; the GET /listings/public row does not. Host-authored
 * text only — never SEO/meta or generated copy (DESIGN-031). Returns '' when the host has written
 * neither, so the page keeps its "Ask the host" empty state.
 *
 * Automatically repairs double-encoded UTF-8 mojibake and normalizes carriage returns (GUEST-038).
 */
export function resolveHostListingDescription(
  payload: Record<string, unknown> | null | undefined,
): string {
  if (!payload) return '';
  const candidates = [
    payload.longDescription,
    payload.LongDescription,
    payload.shortDescription,
    payload.ShortDescription,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return repairMojibake(candidate.trim());
    }
  }
  return '';
}

/**
 * Collapsed "Read more" preview of a description: its first `maxChars` characters plus an ellipsis.
 * Counts code points rather than UTF-16 units so an emoji is never cut in half into a "" glyph —
 * host descriptions routinely use emoji bullets.
 *
 * Repaired through `repairMojibake` to prevent broken multi-byte sequences.
 */
export function previewListingDescription(
  text: string,
  maxChars = 300,
): { preview: string; truncated: boolean } {
  const cleaned = repairMojibake(text);
  const chars = Array.from(cleaned);
  if (chars.length <= maxChars) return { preview: cleaned, truncated: false };
  return { preview: `${chars.slice(0, maxChars).join('').trimEnd()}…`, truncated: true };
}
