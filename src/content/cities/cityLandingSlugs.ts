/** TASK-1479: slugs for SEO city landing routes (`/homestays-in-{slug}`). */
export const CITY_LANDING_SLUGS = ["goa", "coorg", "hyderabad", "manali"] as const;

export type CityLandingSlug = (typeof CITY_LANDING_SLUGS)[number];

export const isCityLandingSlug = (value: string): value is CityLandingSlug =>
  (CITY_LANDING_SLUGS as readonly string[]).includes(value);
