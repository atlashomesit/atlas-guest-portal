import { describe, expect, it } from "vitest";

import { propertySlugMatchesListing } from "./propertySlugMatch";
import { getPropertySlug, buildHomeUnitPath } from "./navigation";

/**
 * TASK-7448 (P0 regression): every listing detail page on every tenant rendered "Home not found"
 * in production while the API returned 200 for the same listing.
 *
 * The TASK-7430 slug guard compared the URL's `:propertySlug` segment against the listing's UNIT
 * name (`TenantPropertyRecord.property_name` holds `dto.name`), while every link builder derives
 * that segment from the PROPERTY name (`dto.propertyName`). Unit name != property name for
 * essentially every real listing, so the guard rejected its own canonical URLs.
 *
 * The TASK-7430 test suite only grepped the source for the string "urlPropertySlugMatches", so it
 * stayed green through a total booking-funnel outage. These tests are BEHAVIOURAL and are driven by
 * the exact payloads production returns.
 */

/** Verbatim from GET /api/listings/public with X-Tenant-Slug: staybycf (prod, 2026-08-05). */
const STAYBYCF_185 = { id: 185, name: "Aurelia Loft - 623", propertyName: "Stay by City Focus" };
/** Verbatim from GET /api/listings/public with X-Tenant-Slug: atlas (prod, 2026-08-05). */
const ATLAS_1 = { id: 1, name: "Atlas101", propertyName: "Atlas Homes" };

/** Mirrors useTenantListings.mapDtoToProperty: property_name = dto.name, propertyName = dto.propertyName. */
const asRecord = (dto: { id: number; name: string; propertyName: string }) => ({
  id: dto.id,
  listingId: dto.id,
  propertyName: dto.propertyName,
  property_name: dto.name,
});

/** Mirrors SearchPage.apiToNormalized / usePropertyListings — the real link builders. */
const linkSlugFor = (dto: { name: string; propertyName: string }) =>
  getPropertySlug({ name: dto.propertyName || dto.name });

describe("TASK-7448: the canonical URL a link builder emits must resolve, not 404", () => {
  for (const dto of [STAYBYCF_185, ATLAS_1]) {
    it(`accepts the slug the app itself links to for "${dto.propertyName}" / "${dto.name}"`, () => {
      const urlSlug = linkSlugFor(dto);

      // Guard against the test asserting a tautology: this is the segment users actually visit.
      expect(buildHomeUnitPath(urlSlug, dto.id)).toBe(`/homes/${urlSlug}/${dto.id}`);

      expect(propertySlugMatchesListing(urlSlug, asRecord(dto))).toBe(true);
    });
  }

  it("REGRESSION: the pre-fix guard input (unit name only) no longer 404s the property slug", () => {
    // This is precisely what TASK-7430 passed in, and why prod broke.
    const preFixInput = { property_name: STAYBYCF_185.name, id: STAYBYCF_185.id };
    expect(propertySlugMatchesListing("stay-by-city-focus", preFixInput)).toBe(false);

    // With the property name carried through (the fix), the same URL resolves.
    expect(propertySlugMatchesListing("stay-by-city-focus", asRecord(STAYBYCF_185))).toBe(true);
  });

  it("still accepts unit-name slugs so legacy deep links keep working", () => {
    expect(propertySlugMatchesListing("aurelia-loft-623", asRecord(STAYBYCF_185))).toBe(true);
    expect(propertySlugMatchesListing("atlas101", asRecord(ATLAS_1))).toBe(true);
  });

  it("tolerates hyphenation differences", () => {
    expect(propertySlugMatchesListing("staybycityfocus", asRecord(STAYBYCF_185))).toBe(true);
  });

  it("is permissive when the URL carries no property segment", () => {
    expect(propertySlugMatchesListing(undefined, asRecord(STAYBYCF_185))).toBe(true);
    expect(propertySlugMatchesListing("", asRecord(STAYBYCF_185))).toBe(true);
  });

  // TASK-7430's intent must survive the fix — a wrong slug still 404s.
  it("PRESERVES TASK-7430: an unrelated property slug is still rejected", () => {
    expect(propertySlugMatchesListing("atlas-homes", asRecord(STAYBYCF_185))).toBe(false);
    expect(propertySlugMatchesListing("stay-by-city-focus", asRecord(ATLAS_1))).toBe(false);
    expect(propertySlugMatchesListing("some-other-property", asRecord(STAYBYCF_185))).toBe(false);
  });

  it("does not match on a mere substring of the property name", () => {
    expect(propertySlugMatchesListing("stay", asRecord(STAYBYCF_185))).toBe(false);
  });
});
