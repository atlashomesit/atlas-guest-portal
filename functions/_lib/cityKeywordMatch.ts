/**
 * MKT-004 / MKT-006: single home for "does this listing belong to city X" keyword matching.
 * Imported by both the React app (`src/utils/cityListingFilter.ts`, via a relative import — this
 * repo's `functions/` and `src/` are separate build targets with no shared `@/` alias) and the
 * sitemap Pages Function (`functions/sitemap.xml.ts`) directly. Kept pure and dependency-free on
 * purpose so both sides can import it without pulling in DOM/React or Workers-runtime types.
 */
export interface CityKeywordHaystack {
  city?: string | null;
  address?: string | null;
  title?: string | null;
}

/** Case-insensitive substring match of any `keywords` entry against the joined haystack fields. */
export function textMatchesCityKeywords(
  hay: CityKeywordHaystack,
  keywords: readonly string[],
): boolean {
  const joined = [hay.city, hay.address, hay.title]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" ")
    .toLowerCase();
  if (!joined) return false;
  return keywords.some((k) => {
    const t = k.trim().toLowerCase();
    return t.length > 0 && joined.includes(t);
  });
}
