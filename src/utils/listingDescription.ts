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
      return candidate.trim();
    }
  }
  return '';
}

/**
 * Collapsed "Read more" preview of a description: its first `maxChars` characters plus an ellipsis.
 * Counts code points rather than UTF-16 units so an emoji is never cut in half into a "�" glyph —
 * host descriptions routinely use emoji bullets.
 */
export function previewListingDescription(
  text: string,
  maxChars = 300,
): { preview: string; truncated: boolean } {
  const chars = Array.from(text);
  if (chars.length <= maxChars) return { preview: text, truncated: false };
  return { preview: `${chars.slice(0, maxChars).join('').trimEnd()}…`, truncated: true };
}
