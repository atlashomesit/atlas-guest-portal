/**
 * TASK-1479: slugs for SEO city landing routes (`/homestays-in-{slug}`).
 * MKT-014: added bengaluru, gurugram, nashik, guwahati — each has live marketplace supply
 * (1 listing each on 2026-10-02). Unknown `homestays-in-<x>` paths are still caught by the
 * `/:shortCode` ShortLinkRedirect fallback (which already carries `noindex`), so the existing
 * 404 surface remains unchanged.
 */
export const CITY_LANDING_SLUGS = [
  "goa",
  "coorg",
  "hyderabad",
  "manali",
  "bengaluru",
  "gurugram",
  "nashik",
  "guwahati",
] as const;

export type CityLandingSlug = (typeof CITY_LANDING_SLUGS)[number];

export const isCityLandingSlug = (value: string): value is CityLandingSlug =>
  (CITY_LANDING_SLUGS as readonly string[]).includes(value);
