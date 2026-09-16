import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mapDtoToProperty, type TenantPropertyRecord } from "./useTenantListings";
import type { PublicListing } from "@/api/listingClient";

vi.mock("@/tenant/tenantContext", () => ({
  getTenantContext: vi.fn(),
}));

vi.mock("@/tenant/tenantOverrides", () => ({
  getTenantOverrides: vi.fn(() => ({})),
  getTenantListingAddress: vi.fn(() => undefined),
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

  it("TASK-102020: preserves checkInTime and checkOutTime from PublicListing DTO", () => {
    const dto: PublicListing = {
      id: 637,
      name: "Villa Azure - 101",
      propertyName: "Villa Azure",
      maxGuests: 4,
      photoUrls: [],
      propertyAddress: null,
      checkInTime: "14:00",
      checkOutTime: "11:00",
    };

    const property = mapDtoToProperty(dto) as TenantPropertyRecord;
    expect(property.checkInTime).toBe("14:00");
    expect(property.checkOutTime).toBe("11:00");
  });
});
