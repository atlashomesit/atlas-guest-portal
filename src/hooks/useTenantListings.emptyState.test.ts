/**
 * DESIGN-031 — mapDtoToProperty must not invent description/amenities/location from Atlas demo catalog.
 */
import { describe, expect, it } from "vitest";
import { mapDtoToProperty } from "./useTenantListings";
import type { PublicListing } from "@/api/listingClient";

describe("mapDtoToProperty empty-state honesty (DESIGN-031)", () => {
  it("leaves description empty instead of inventing Comfortable stay…", () => {
    const dto: PublicListing = {
      id: 191,
      name: "Unit 191",
      propertyName: "Stay by City Focus",
      maxGuests: 2,
      photoUrls: [],
      propertyAddress: null,
      seoDescription: null,
      metaDescription: null,
    };
    const property = mapDtoToProperty(dto);
    expect(property.property_description).toBe("");
    expect(property.property_description).not.toMatch(/comfortable stay/i);
  });

  it("does not pad amenities from bundled propertyData on listingId collision", () => {
    // listingId 1–7 collide with Atlas demo catalog rows in propertyData.
    const dto: PublicListing = {
      id: 1,
      name: "Sparse unit",
      propertyName: "White Label Home",
      maxGuests: 2,
      photoUrls: [],
      propertyAddress: null,
      amenityCodes: [],
    };
    const property = mapDtoToProperty(dto);
    expect(property.property_amenities).toEqual([]);
    expect(property.property_location).toBe("");
  });
});
