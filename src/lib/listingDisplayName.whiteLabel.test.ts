import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getListingDisplayName } from "./listingDisplayName";

vi.mock("../tenant/tenantContext", () => ({
  getTenantContext: vi.fn(),
}));

vi.mock("../tenant/tenantOverrides", () => ({
  getTenantOverrides: vi.fn(() => ({})),
  shouldHideAtlasBranding: vi.fn(),
}));

import { getTenantContext } from "../tenant/tenantContext";
import { shouldHideAtlasBranding } from "../tenant/tenantOverrides";

describe("listingDisplayName white-label (TASK-7194)", () => {
  beforeEach(() => {
    vi.mocked(getTenantContext).mockReturnValue({ slug: "staybycf", name: "Stay by CF" });
    vi.mocked(shouldHideAtlasBranding).mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("does not rename room 501 to Penthouse 501 on white-label tenants", () => {
    expect(getListingDisplayName(501, "Oakmont 2bhk - 501")).toBe("Oakmont 2bhk - 501");
  });

  it("does not remap Atlas SKUs on white-label tenants", () => {
    expect(getListingDisplayName(5, "Atlas501_PH")).toBe("Atlas501_PH");
  });
});

describe("listingDisplayName atlas marketplace", () => {
  beforeEach(() => {
    vi.mocked(getTenantContext).mockReturnValue({ slug: "atlas", name: "Atlas Homes" });
    vi.mocked(shouldHideAtlasBranding).mockReturnValue(false);
  });

  it("still maps Atlas SKUs on marketplace surfaces", () => {
    expect(getListingDisplayName(5, "Atlas501_PH")).toBe("Penthouse 501");
  });
});
