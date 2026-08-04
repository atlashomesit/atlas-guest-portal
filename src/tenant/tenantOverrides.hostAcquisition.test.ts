import { describe, expect, it } from "vitest";
import { shouldShowHostAcquisitionCtas } from "./tenantOverrides";

describe("shouldShowHostAcquisitionCtas (TASK-7434)", () => {
  it("hides host CTAs for white-label tenant slugs by default", () => {
    expect(
      shouldShowHostAcquisitionCtas({ slug: "staybycf", isMarketplaceRoot: false }, {}),
    ).toBe(false);
  });

  it("shows host CTAs for the atlas marketplace slug", () => {
    expect(shouldShowHostAcquisitionCtas({ slug: "atlas" }, {})).toBe(true);
  });

  it("shows host CTAs when isMarketplaceRoot is true", () => {
    expect(
      shouldShowHostAcquisitionCtas({ slug: "custom", isMarketplaceRoot: true }, {}),
    ).toBe(true);
  });

  it("allows explicit opt-in via showHostAcquisition", () => {
    expect(
      shouldShowHostAcquisitionCtas({ slug: "staybycf" }, { showHostAcquisition: true }),
    ).toBe(true);
  });

  it("respects deprecated hideListProperty=true as opt-out", () => {
    expect(
      shouldShowHostAcquisitionCtas({ slug: "atlas" }, { hideListProperty: true }),
    ).toBe(false);
  });
});
