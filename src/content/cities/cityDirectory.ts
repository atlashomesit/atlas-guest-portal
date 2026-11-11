/**
 * MKT-034: the city directory. One entry per `CITY_LANDING_SLUGS` slug (the compiler enforces it), kept tiny on
 * purpose so the marketplace homepage can show its "Explore Top Destinations" strip without pulling the nine
 * city-guide JSON bundles into the main chunk. The long-form guide stays in `src/content/cities/<slug>.json`.
 * `cityDirectory.test.ts` pins each display name against its guide's `cityName` so the two cannot drift apart.
 */
import { CITY_LANDING_SLUGS, type CityLandingSlug } from "./cityLandingSlugs";

export type CityDirectoryEntry = {
  slug: CityLandingSlug;
  /** The short name travellers search for (the guide's `cityName` may add the local name, e.g. "Coorg (Kodagu)"). */
  name: string;
  /** One line taken from the guide's own headline; no supply or price claim. */
  tagline: string;
  /** The SEO guide this entry links to. */
  path: string;
};

/** `/homestays-in-{slug}`: the city guide route registered in App.tsx. */
export const cityGuidePath = (slug: CityLandingSlug): string => `/homestays-in-${slug}`;

const CITY_COPY: Record<CityLandingSlug, { name: string; tagline: string }> = {
  goa: { name: "Goa", tagline: "Book direct with trusted hosts" },
  coorg: { name: "Coorg", tagline: "Coffee estates, mist, and Kodava hospitality" },
  hyderabad: { name: "Hyderabad", tagline: "HITEC City work trips and Old City weekends" },
  manali: { name: "Manali", tagline: "River valleys, apple orchards, and mountain hosts" },
  bengaluru: { name: "Bengaluru", tagline: "Indiranagar weekends and Whitefield work weeks" },
  gurugram: { name: "Gurugram", tagline: "Cyber Hub work trips and Golf Course Road weekends" },
  nashik: { name: "Nashik", tagline: "Vineyard weekends and Trimbakeshwar temple circuits" },
  guwahati: { name: "Guwahati", tagline: "Brahmaputra sunsets and Kamakhya temple circuits" },
  jalandhar: { name: "Jalandhar", tagline: "Doaba hospitality and Model Town cafes" },
};

export const CITY_DIRECTORY: readonly CityDirectoryEntry[] = CITY_LANDING_SLUGS.map((slug) => ({
  slug,
  ...CITY_COPY[slug],
  path: cityGuidePath(slug),
}));
