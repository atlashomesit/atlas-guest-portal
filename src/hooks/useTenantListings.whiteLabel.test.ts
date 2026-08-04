import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mapDtoToProperty, type TenantPropertyRecord } from "./useTenantListings";
import type { PublicListing } from "@/api/listingClient";

vi.mock("@/tenant/tenantContext", () => ({
  getTenantContext: vi.fn(),
}));

vi.mock("@/tenant/tenantOverrides", () => ({
  getTenantOverrides: vi.fn(() => ({})),
  getTenantPublicListingIdAllowlist: vi.fn(() => new Set<number>()),
}));

describe("useTenantListings mapDtoToProperty (TASK-7194)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("does not default property_location to Hyderabad when API address is absent", () => {
    const dto: PublicListing = {
      id: 42,
      name: "Oakmont 2bhk - 501",
      propertyName: "Oakmont",
      maxGuests: 4,
      photoUrls: [],
      propertyAddress: null,
    };

    const property = mapDtoToProperty(dto) as TenantPropertyRecord;
    expect(property.property_location).toBe("");
    expect(property.property_location).not.toMatch(/hyderabad/i);
  });
});
