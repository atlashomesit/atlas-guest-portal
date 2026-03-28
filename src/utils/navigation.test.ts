import { describe, expect, it } from "vitest";
import { buildHomeUnitPath, getListingIdSegment } from "./navigation";

describe("navigation", () => {
  describe("getListingIdSegment", () => {
    it("returns string representation of listingId", () => {
      expect(getListingIdSegment(2)).toBe("2");
      expect(getListingIdSegment(7)).toBe("7");
    });
  });

  describe("buildHomeUnitPath", () => {
    it("builds path with listingId (PK), not room code", () => {
      expect(buildHomeUnitPath("atlas-homes", 2)).toBe("/homes/atlas-homes/2");
      expect(buildHomeUnitPath("atlas-penthouse-501", 7)).toBe("/homes/atlas-penthouse-501/7");
    });

    it("TRAP FIXTURE: given id=2 and name=Atlas102, link MUST use 2 not 102", () => {
      const listing = { id: 2, name: "Atlas102", propertyId: 1 };
      const propertySlug = "atlas-homes-room-102";
      const path = buildHomeUnitPath(propertySlug, listing.id as number);
      expect(path).toBe("/homes/atlas-homes-room-102/2");
      expect(path).not.toContain("/102");
      expect(path).not.toMatch(/\/102$/);
    });
  });
});
