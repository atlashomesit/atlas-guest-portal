/**
 * MKT-034: the city directory has one entry per city guide, in the guide registry's order, linking to the guide route,
 * and each short display name agrees with the guide's own `cityName` so the two cannot drift apart.
 */
import { describe, expect, it } from "vitest";

import { CITY_DIRECTORY, cityGuidePath } from "./cityDirectory";
import { CITY_LANDING_SLUGS } from "./cityLandingSlugs";

import coorg from "./coorg.json";
import goa from "./goa.json";
import hyderabad from "./hyderabad.json";
import manali from "./manali.json";
import bengaluru from "./bengaluru.json";
import gurugram from "./gurugram.json";
import nashik from "./nashik.json";
import guwahati from "./guwahati.json";
import jalandhar from "./jalandhar.json";

const GUIDE_CITY_NAME: Record<string, string> = {
  coorg: coorg.cityName,
  goa: goa.cityName,
  hyderabad: hyderabad.cityName,
  manali: manali.cityName,
  bengaluru: bengaluru.cityName,
  gurugram: gurugram.cityName,
  nashik: nashik.cityName,
  guwahati: guwahati.cityName,
  jalandhar: jalandhar.cityName,
};

describe("MKT-034: city directory", () => {
  it("has exactly one entry per city guide, in registry order", () => {
    expect(CITY_DIRECTORY.map((c) => c.slug)).toEqual([...CITY_LANDING_SLUGS]);
  });

  it("links every entry to its /homestays-in-{slug} guide", () => {
    for (const city of CITY_DIRECTORY) {
      expect(city.path).toBe(`/homestays-in-${city.slug}`);
      expect(cityGuidePath(city.slug)).toBe(city.path);
    }
  });

  it("gives every entry a name and a tagline", () => {
    for (const city of CITY_DIRECTORY) {
      expect(city.name.trim().length).toBeGreaterThan(0);
      expect(city.tagline.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps each display name consistent with its guide's cityName", () => {
    for (const city of CITY_DIRECTORY) {
      expect(GUIDE_CITY_NAME[city.slug].toLowerCase().startsWith(city.name.toLowerCase())).toBe(true);
    }
  });
});
