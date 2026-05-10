/**
 * TASK-2208: Listing names from the catalog API often arrive as raw underscored
 * slugs (e.g. `Star_Guest_House_201`) rather than display-ready text. This
 * helper turns them into a human-readable title for any guest-facing surface
 * (h1, document.title, OG tags, JSON-LD `name`, card titles, alt text, share
 * messages, WhatsApp deep-links, etc.).
 *
 * Behaviour:
 *  - replaces every `_` with a single space
 *  - collapses runs of whitespace into a single space
 *  - trims leading/trailing whitespace
 *  - returns the input unchanged for non-strings, `null`, `undefined`, or empty
 *    strings (so callers can do `formatListingTitle(name) || fallback`)
 */
export const formatListingTitle = (
  name: string | null | undefined,
): string => {
  if (typeof name !== "string") return "";
  if (!name) return "";
  return name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
};

export default formatListingTitle;
