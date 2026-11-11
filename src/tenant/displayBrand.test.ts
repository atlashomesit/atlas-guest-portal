import { describe, expect, it, beforeEach } from "vitest";
import { _setTenantContextForTests, type TenantInfo } from "./tenantContext";
import {
  withTenantBrandInCopy,
  getTenantBrandName,
  getTenantContactEmail,
  isNeutralBrandingMode,
  MARKETPLACE_BRAND_BASELINE,
  NEUTRAL_NO_BRAND_FALLBACK,
} from "./displayBrand";

describe("withTenantBrandInCopy (CPO-001)", () => {
  beforeEach(() => {
    _setTenantContextForTests({
      slug: "starguesthouse",
      name: "Star Guest House",
      brandName: "Star Guest House",
    } as TenantInfo);
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

// ---------------------------------------------------------------------------
// TASK-4899: Neutral-mode guest-portal skin — no Atlas marks for a Neutral-mode
// tenant, including when zero branding is configured at all. Platform mode
// (Atlas's own tenant, or any tenant where Neutral status can't yet be confirmed
// because the API hasn't shipped `guestCommsBrandingMode`) keeps today's rendering.
// ---------------------------------------------------------------------------
describe("TASK-4899: isNeutralBrandingMode / brand-name+email fallbacks", () => {
  it("isNeutralBrandingMode is false when guestCommsBrandingMode is undefined (API gap, safe default)", () => {
    _setTenantContextForTests({
      slug: "some-tenant",
      name: "",
    } as TenantInfo);
    expect(isNeutralBrandingMode()).toBe(false);
  });

  it("isNeutralBrandingMode is false for Platform mode", () => {
    _setTenantContextForTests({
      slug: "atlas",
      name: "Atlastays",
      guestCommsBrandingMode: "Platform",
    } as TenantInfo);
    expect(isNeutralBrandingMode()).toBe(false);
  });

  it("isNeutralBrandingMode is true for Neutral mode", () => {
    _setTenantContextForTests({
      slug: "gaurav",
      name: "",
      guestCommsBrandingMode: "Neutral",
    } as TenantInfo);
    expect(isNeutralBrandingMode()).toBe(true);
  });

  describe("getTenantBrandName", () => {
    it("neutral-with-branding: uses the tenant's own configured display name unchanged", () => {
      _setTenantContextForTests({
        slug: "gaurav",
        name: "Gaurav Personal",
        brandName: "Gaurav Personal",
        legalContactPack: {
          displayName: "Elsiya Loft",
          showAtlasFooterCredit: false,
          isCustomDomain: false,
        },
        guestCommsBrandingMode: "Neutral",
      } as TenantInfo);
      expect(getTenantBrandName()).toBe("Elsiya Loft");
    });

    it("neutral-no-branding: falls back to the generic property-only name, never an Atlas mark", () => {
      _setTenantContextForTests({
        slug: "brand-new-tenant",
        name: "",
        guestCommsBrandingMode: "Neutral",
      } as TenantInfo);
      const name = getTenantBrandName();
      expect(name).toBe(NEUTRAL_NO_BRAND_FALLBACK);
      expect(name.toLowerCase()).not.toContain("atlas");
    });

    it("platform-mode regression: unset name still falls back to MARKETPLACE_BRAND_BASELINE", () => {
      _setTenantContextForTests({
        slug: "atlas",
        name: "",
        guestCommsBrandingMode: "Platform",
      } as TenantInfo);
      expect(getTenantBrandName()).toBe(MARKETPLACE_BRAND_BASELINE);
    });

    it("API-gap regression: unset name + undefined guestCommsBrandingMode still falls back to MARKETPLACE_BRAND_BASELINE", () => {
      _setTenantContextForTests({
        slug: "some-tenant",
        name: "",
      } as TenantInfo);
      expect(getTenantBrandName()).toBe(MARKETPLACE_BRAND_BASELINE);
    });

    // TASK-7431: business display name outranks short brandName/name
    it("TASK-7431: prefers legalContactPack.displayName over brandName/name", () => {
      _setTenantContextForTests({
        slug: "sunrise",
        name: "Sunrise Short",
        brandName: "Sunrise Short",
        legalContactPack: {
          displayName: "Sunrise Villas Business",
          showAtlasFooterCredit: false,
          isCustomDomain: true,
        },
        guestCommsBrandingMode: "Neutral",
      } as TenantInfo);
      expect(getTenantBrandName()).toBe("Sunrise Villas Business");
    });

    it("TASK-7431: prefers brandNameLong when displayName is absent", () => {
      _setTenantContextForTests({
        slug: "sunrise",
        name: "Sunrise Short",
        brandName: "Sunrise Short",
        brandNameLong: "Sunrise Villas Pvt Ltd",
        guestCommsBrandingMode: "Neutral",
      } as TenantInfo);
      expect(getTenantBrandName()).toBe("Sunrise Villas Pvt Ltd");
    });

    it("TASK-7468: Neutral never publishes Tenants.Name when no business brand is set", () => {
      _setTenantContextForTests({
        slug: "sunrise",
        name: "Sunrise Short",
        brandName: "Sunrise Short",
        guestCommsBrandingMode: "Neutral",
      } as TenantInfo);
      expect(getTenantBrandName()).toBe(NEUTRAL_NO_BRAND_FALLBACK);
    });

    it("TASK-7431: Neutral never falls back to a personal brandName", () => {
      _setTenantContextForTests({
        slug: "millionairesmansion",
        name: "",
        brandName: "mahesh wagh",
        legalContactPack: {
          displayName: "Millionaresmansion",
          legalName: "Millionaresmansion",
          showAtlasFooterCredit: false,
          isCustomDomain: false,
        },
        guestCommsBrandingMode: "Neutral",
      } as TenantInfo);
      expect(getTenantBrandName()).toBe("Millionaresmansion");
    });

    it("TASK-7431: Neutral with only personal brandName uses neutral fallback", () => {
      _setTenantContextForTests({
        slug: "solo-host",
        name: "",
        brandName: "mahesh wagh",
        guestCommsBrandingMode: "Neutral",
      } as TenantInfo);
      expect(getTenantBrandName()).toBe(NEUTRAL_NO_BRAND_FALLBACK);
    });
  });

  describe("getTenantContactEmail", () => {
    it("neutral-with-branding: uses the tenant's own configured email unchanged", () => {
      _setTenantContextForTests({
        slug: "gaurav",
        name: "Elsiya Loft",
        guestCommsBrandingMode: "Neutral",
        legalContactPack: { contactEmail: "stay@elsiyaloft.example", showAtlasFooterCredit: false, isCustomDomain: false },
      } as TenantInfo);
      expect(getTenantContactEmail("support")).toBe("stay@elsiyaloft.example");
    });

    it("neutral-no-branding: omits the email (never the Atlas support/privacy address), even off a custom domain", () => {
      _setTenantContextForTests({
        slug: "brand-new-tenant",
        name: "",
        guestCommsBrandingMode: "Neutral",
        legalContactPack: { showAtlasFooterCredit: false, isCustomDomain: false },
      } as TenantInfo);
      expect(getTenantContactEmail("support")).toBe("");
      expect(getTenantContactEmail("privacy")).toBe("");
    });

    it("platform-mode regression: unset email still falls back to the Atlas support/privacy address", () => {
      _setTenantContextForTests({
        slug: "atlas",
        name: "Atlastays",
        guestCommsBrandingMode: "Platform",
      } as TenantInfo);
      expect(getTenantContactEmail("support")).toContain("atlastays.com");
      expect(getTenantContactEmail("privacy")).toContain("atlastays.com");
    });
  });
});
