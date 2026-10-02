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

describe("MKT-014: city landing slug registry", () => {
  it("includes the four new cities added by MKT-014 (bengaluru, gurugram, nashik, guwahati)", () => {
    expect(CITY_LANDING_SLUGS).toContain("bengaluru");
    expect(CITY_LANDING_SLUGS).toContain("gurugram");
    expect(CITY_LANDING_SLUGS).toContain("nashik");
    expect(CITY_LANDING_SLUGS).toContain("guwahati");
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

  it("isCityLandingSlug rejects values not in the registry", () => {
    expect(isCityLandingSlug("atlantis")).toBe(false);
    expect(isCityLandingSlug("")).toBe(false);
  });
});