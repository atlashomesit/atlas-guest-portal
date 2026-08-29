import { describe, expect, it } from "vitest";
import { ATLAS_HOMES_LOGO_URL, LOGO_URL, resolveGuestLogoUrl } from "./branding";

describe("resolveGuestLogoUrl", () => {
  it("prefers an explicit override", () => {
    expect(
      resolveGuestLogoUrl({
        overrideLogoUrl: "/images/stay-bycityfocus-logo.png",
        tenantLogoUrl: "https://cdn.example.com/api-logo.png",
        slug: "atlas",
      }),
    ).toBe("/images/stay-bycityfocus-logo.png");
  });

  it("uses the Atlas Homes lockup for marketplace slugs even without an override", () => {
    expect(resolveGuestLogoUrl({ slug: "atlas" })).toBe(ATLAS_HOMES_LOGO_URL);
    expect(resolveGuestLogoUrl({ slug: "marketplace" })).toBe(ATLAS_HOMES_LOGO_URL);
  });

  it("falls back to the brand-neutral placeholder for unknown tenants", () => {
    expect(resolveGuestLogoUrl({ slug: "some-other-tenant" })).toBe(LOGO_URL);
  });

  it("uses the tenant API logo for white-label tenants without a repo override", () => {
    expect(
      resolveGuestLogoUrl({
        slug: "sunrise-villas",
        tenantLogoUrl: "https://cdn.example.com/sunrise.png",
      }),
    ).toBe("https://cdn.example.com/sunrise.png");
  });
});
