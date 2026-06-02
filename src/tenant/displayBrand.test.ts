import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./tenantContext", () => ({
  getTenantContext: vi.fn(),
}));

import { getTenantContext } from "./tenantContext";
import { withTenantBrandInCopy } from "./displayBrand";

describe("withTenantBrandInCopy (CPO-001)", () => {
  beforeEach(() => {
    vi.mocked(getTenantContext).mockReturnValue({
      slug: "starguesthouse",
      name: "Star Guest House",
      brandName: "Star Guest House",
    } as ReturnType<typeof getTenantContext>);
  });

  it("replaces legacy Atlas Homestays in static SEO templates", () => {
    expect(
      withTenantBrandInCopy("Book direct on Atlas Homestays — Goa homestays"),
    ).toBe("Book direct on Star Guest House — Goa homestays");
  });

  it("replaces {{TENANT_BRAND}} placeholders in static templates", () => {
    expect(withTenantBrandInCopy("Book direct on {{TENANT_BRAND}} — Goa homestays")).toBe(
      "Book direct on Star Guest House — Goa homestays",
    );
  });

  it("leaves copy unchanged when no legacy brand string is present", () => {
    expect(withTenantBrandInCopy("Homestays near the beach")).toBe("Homestays near the beach");
  });
});
