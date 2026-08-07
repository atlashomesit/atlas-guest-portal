import { getPropertySlug } from './navigation';

/**
 * TASK-7448 (P0): decide whether the `:propertySlug` segment of `/homes/:propertySlug/:unitSlug`
 * legitimately identifies a listing.
 *
 * WHY THIS EXISTS — the TASK-7430 regression that took the whole booking funnel down:
 *
 * TASK-7430 added a 404 guard so a wrong property slug could not render an unrelated listing. Its
 * intent is right, but it compared the URL slug against `TenantPropertyRecord.property_name` —
 * which, despite the name, holds the *UNIT* name (`mapDtoToProperty` prefers `dto.name` over
 * `dto.propertyName`). Meanwhile every link builder in the app (SearchPage, usePropertyListings,
 * CityLandingPage, FavoritesPage, sitemap, ...) builds the slug from the *PROPERTY* name
 * (`dto.propertyName`). So the guard compared a unit slug to a property slug and rejected its own
 * canonical URLs:
 *
 *   staybycf  listing 185 → name "Aurelia Loft - 623", propertyName "Stay by City Focus"
 *                           link  /homes/stay-by-city-focus/185
 *                           guard expected "aurelia-loft-623"   → 404
 *   atlas     listing 1   → name "Atlas101",           propertyName "Atlas Homes"
 *                           link  /homes/atlas-homes/1
 *                           guard expected "atlas101"           → 404
 *
 * Because unit name != property name for essentially every real listing, EVERY listing detail page
 * on EVERY tenant 404'd. The API was returning 200 the whole time — this was purely client-side.
 *
 * The fix: match against the canonical PROPERTY slug (what links actually contain) while still
 * accepting the unit-derived slug, so legacy/unit-style URLs keep working. A genuinely unrelated
 * slug is still rejected, preserving TASK-7430's intent.
 */

const normalizeSlug = (value?: string | number | null): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

const stripHyphens = (value: string): string => value.replace(/-/g, '');

export type PropertySlugCandidate = {
  /** Canonical property name (`dto.propertyName`) — the source every link builder slugifies. */
  propertyName?: string | null;
  /** Unit/listing name (`dto.name`), stored as `property_name` on TenantPropertyRecord. */
  property_name?: string | null;
  id?: string | number | null;
};

/**
 * All slugs that may legitimately appear in the `:propertySlug` segment for this listing.
 * Exported for testing.
 */
export function acceptablePropertySlugs(item: PropertySlugCandidate): string[] {
  const sources = [item.propertyName, item.property_name];
  const slugs = new Set<string>();

  for (const source of sources) {
    if (typeof source !== 'string' || !source.trim()) continue;
    // Mirror the link builders exactly: getPropertySlug is what produced the URL.
    slugs.add(normalizeSlug(getPropertySlug({ property_name: source, name: source, id: item.id ?? undefined })));
  }

  return Array.from(slugs).filter(Boolean);
}

/**
 * True when `urlPropertySlug` matches this listing's property or unit slug.
 * An empty/absent URL slug is permissive (legacy routes without the segment).
 */
export function propertySlugMatchesListing(
  urlPropertySlug: string | undefined | null,
  item: PropertySlugCandidate,
): boolean {
  const normalizedUrlSlug = normalizeSlug(urlPropertySlug);
  if (!normalizedUrlSlug) return true;

  const strippedUrlSlug = stripHyphens(normalizedUrlSlug);

  return acceptablePropertySlugs(item).some(
    (expected) => expected === normalizedUrlSlug || stripHyphens(expected) === strippedUrlSlug,
  );
}
