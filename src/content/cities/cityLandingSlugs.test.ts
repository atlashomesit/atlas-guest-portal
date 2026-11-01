/**
 * MKT-014 (`docs/product/cpo-backlogs/marketplace.md`): the city landing route handler accepts
 * only the slugs registered in `CITY_LANDING_SLUGS`; unknown `homestays-in-<x>` paths fall
 * through to the `/:shortCode` ShortLinkRedirect fallback, which already carries `noindex`
 * (asserted in `tests/.../ShortLinkRedirect`). This test pins the registry shape itself.
 */
import { describe, it, expect } from "vitest";
import {
  CITY_LANDING_SLUGS,
  isCityLandingSlug,
  type CityLandingSlug,
} from "./cityLandingSlugs";

describe("MKT-014 / MKT-017: city landing slug registry", () => {
  it("includes the new cities added by MKT-014 and MKT-017 (bengaluru, gurugram, nashik, guwahati, jalandhar)", () => {
    expect(CITY_LANDING_SLUGS).toContain("bengaluru");
    expect(CITY_LANDING_SLUGS).toContain("gurugram");
    expect(CITY_LANDING_SLUGS).toContain("nashik");
    expect(CITY_LANDING_SLUGS).toContain("guwahati");
    expect(CITY_LANDING_SLUGS).toContain("jalandhar");
  });

  it("still includes the original four cities", () => {
    expect(CITY_LANDING_SLUGS).toContain("goa");
    expect(CITY_LANDING_SLUGS).toContain("coorg");
    expect(CITY_LANDING_SLUGS).toContain("hyderabad");
    expect(CITY_LANDING_SLUGS).toContain("manali");
  });

  it("isCityLandingSlug narrows a slug into the CityLandingSlug union", () => {
    const slug: string = "bengaluru";
    if (!isCityLandingSlug(slug)) {
      throw new Error("expected isCityLandingSlug to recognise bengaluru");
    }
    // TS-only: re-type the narrowed value. The runtime assertion is the if-branch above.
    const narrowed: CityLandingSlug = slug;
    expect(narrowed).toBe("bengaluru");
  });

  // MKT-040: atlas-api `ReservedSlugs.NewClaimsOnly` reserves exactly these nine so a NEW tenant cannot be slugged "goa" and be shadowed by
  // the city redirect on atlastays.com. atlas-api's `ReservedSlugsCityGuideTests` carries the same literal nine. Adding or renaming a
  // city fails this test until the API list is updated too (and the other way round).
  it("MKT-040: is exactly the nine slugs atlas-api reserves against new tenant claims", () => {
    expect([...CITY_LANDING_SLUGS].sort()).toEqual(
      ["bengaluru", "coorg", "goa", "gurugram", "guwahati", "hyderabad", "jalandhar", "manali", "nashik"],
    );
  });

  it("isCityLandingSlug rejects values not in the registry", () => {
    expect(isCityLandingSlug("atlantis")).toBe(false);
    expect(isCityLandingSlug("")).toBe(false);
  });
});