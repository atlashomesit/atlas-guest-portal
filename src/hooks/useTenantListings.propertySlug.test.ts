import { describe, expect, it, vi } from "vitest";

import { mapDtoToProperty } from "./useTenantListings";
import type { PublicListing } from "@/api/listingClient";
import { getPropertySlug } from "@/utils/navigation";
import { propertySlugMatchesListing } from "@/utils/propertySlugMatch";

vi.mock("@/tenant/tenantContext", () => ({ getTenantContext: vi.fn(() => ({ slug: "staybycf" })) }));
vi.mock("@/tenant/tenantOverrides", () => ({
  getTenantOverrides: vi.fn(() => ({})),
  getTenantPublicListingIdAllowlist: vi.fn(() => new Set<number>()),
}));

/**
 * TASK-7448 (P0): closes the loop end-to-end with NO mocking of the units under test —
 * real mapDtoToProperty -> real getPropertySlug link builder -> real slug guard.
 *
 * This is the shape of test that would have caught the outage. The TASK-7430 suite asserted only
 * that the guard *existed* (a source-text grep), so it stayed green while every listing detail page
 * on every tenant 404'd in production.
 */

/** Verbatim shapes from GET /api/listings/public in prod on 2026-08-05. */
const PROD_DTOS: Array<Pick<PublicListing, "id" | "name" | "propertyName">> = [
  { id: 185, name: "Aurelia Loft - 623", propertyName: "Stay by City Focus" },
  { id: 191, name: "Elsiya loft - 1803", propertyName: "Stay by City Focus" },
  { id: 1, name: "Atlas101", propertyName: "Atlas Homes" },
  { id: 7, name: "Atlas Penthouse", propertyName: "Atlas Homes" },
];

describe("TASK-7448: listing-detail URLs the app generates must resolve", () => {
  it.each(PROD_DTOS)(
    "listing $id ($name @ $propertyName) resolves via its own canonical link",
    (dto) => {
      const record = mapDtoToProperty(dto as PublicListing);

      // The segment SearchPage / usePropertyListings actually put in the href.
      const urlPropertySlug = getPropertySlug({ name: dto.propertyName || dto.name });

      expect(propertySlugMatchesListing(urlPropertySlug, record)).toBe(true);
    },
  );

  it("mapDtoToProperty preserves the canonical property name distinctly from the unit name", () => {
    const record = mapDtoToProperty(PROD_DTOS[0] as PublicListing);

    // The historical trap: `property_name` is the UNIT name, not the property name.
    expect(record.property_name).toBe("Aurelia Loft - 623");
    expect(record.propertyName).toBe("Stay by City Focus");
  });

  it("a listing still does not resolve under a different property's slug", () => {
    const staybycf = mapDtoToProperty(PROD_DTOS[0] as PublicListing);
    expect(propertySlugMatchesListing("atlas-homes", staybycf)).toBe(false);
  });
});
