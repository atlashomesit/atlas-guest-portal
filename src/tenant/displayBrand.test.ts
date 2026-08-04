import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./tenantContext", () => ({
  getTenantContext: vi.fn(),
}));

import { getTenantContext } from "./tenantContext";
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

// ---------------------------------------------------------------------------
// TASK-4899: Neutral-mode guest-portal skin — no Atlas marks for a Neutral-mode
// tenant, including when zero branding is configured at all. Platform mode
// (Atlas's own tenant, or any tenant where Neutral status can't yet be confirmed
// because the API hasn't shipped `guestCommsBrandingMode`) keeps today's rendering.
// ---------------------------------------------------------------------------
describe("TASK-4899: isNeutralBrandingMode / brand-name+email fallbacks", () => {
  it("isNeutralBrandingMode is false when guestCommsBrandingMode is undefined (API gap, safe default)", () => {
    vi.mocked(getTenantContext).mockReturnValue({
      slug: "some-tenant",
      name: "",
    } as ReturnType<typeof getTenantContext>);
    expect(isNeutralBrandingMode()).toBe(false);
  });

  it("isNeutralBrandingMode is false for Platform mode", () => {
    vi.mocked(getTenantContext).mockReturnValue({
      slug: "atlas",
      name: "Atlastays",
      guestCommsBrandingMode: "Platform",
    } as ReturnType<typeof getTenantContext>);
    expect(isNeutralBrandingMode()).toBe(false);
  });

  it("isNeutralBrandingMode is true for Neutral mode", () => {
    vi.mocked(getTenantContext).mockReturnValue({
      slug: "gaurav",
      name: "",
      guestCommsBrandingMode: "Neutral",
    } as ReturnType<typeof getTenantContext>);
    expect(isNeutralBrandingMode()).toBe(true);
  });

  describe("getTenantBrandName", () => {
    it("neutral-with-branding: uses the tenant's own configured name unchanged", () => {
      vi.mocked(getTenantContext).mockReturnValue({
        slug: "gaurav",
        name: "Elsiya Loft",
        brandName: "Elsiya Loft",
        guestCommsBrandingMode: "Neutral",
      } as ReturnType<typeof getTenantContext>);
      expect(getTenantBrandName()).toBe("Elsiya Loft");
    });

    it("neutral-no-branding: falls back to the generic property-only name, never an Atlas mark", () => {
      vi.mocked(getTenantContext).mockReturnValue({
        slug: "brand-new-tenant",
        name: "",
        guestCommsBrandingMode: "Neutral",
      } as ReturnType<typeof getTenantContext>);
      const name = getTenantBrandName();
      expect(name).toBe(NEUTRAL_NO_BRAND_FALLBACK);
      expect(name.toLowerCase()).not.toContain("atlas");
    });

    it("platform-mode regression: unset name still falls back to MARKETPLACE_BRAND_BASELINE", () => {
      vi.mocked(getTenantContext).mockReturnValue({
        slug: "atlas",
        name: "",
        guestCommsBrandingMode: "Platform",
      } as ReturnType<typeof getTenantContext>);
      expect(getTenantBrandName()).toBe(MARKETPLACE_BRAND_BASELINE);
    });

    it("API-gap regression: unset name + undefined guestCommsBrandingMode still falls back to MARKETPLACE_BRAND_BASELINE", () => {
      vi.mocked(getTenantContext).mockReturnValue({
        slug: "some-tenant",
        name: "",
      } as ReturnType<typeof getTenantContext>);
      expect(getTenantBrandName()).toBe(MARKETPLACE_BRAND_BASELINE);
    });

    // TASK-7431: business display name outranks short brandName/name
    it("TASK-7431: prefers legalContactPack.displayName over brandName/name", () => {
      vi.mocked(getTenantContext).mockReturnValue({
        slug: "sunrise",
        name: "Sunrise Short",
        brandName: "Sunrise Short",
        legalContactPack: {
          displayName: "Sunrise Villas Business",
          showAtlasFooterCredit: false,
          isCustomDomain: true,
        },
        guestCommsBrandingMode: "Neutral",
      } as ReturnType<typeof getTenantContext>);
      expect(getTenantBrandName()).toBe("Sunrise Villas Business");
    });

    it("TASK-7431: prefers brandNameLong when displayName is absent", () => {
      vi.mocked(getTenantContext).mockReturnValue({
        slug: "sunrise",
        name: "Sunrise Short",
        brandName: "Sunrise Short",
        brandNameLong: "Sunrise Villas Pvt Ltd",
        guestCommsBrandingMode: "Neutral",
      } as ReturnType<typeof getTenantContext>);
      expect(getTenantBrandName()).toBe("Sunrise Villas Pvt Ltd");
    });

    it("TASK-7431: Neutral uses tenant name when no business display name or long brand", () => {
      vi.mocked(getTenantContext).mockReturnValue({
        slug: "sunrise",
        name: "Sunrise Short",
        brandName: "Sunrise Short",
        guestCommsBrandingMode: "Neutral",
      } as ReturnType<typeof getTenantContext>);
      expect(getTenantBrandName()).toBe("Sunrise Short");
    });

    it("TASK-7431: Neutral never falls back to a personal brandName", () => {
      vi.mocked(getTenantContext).mockReturnValue({
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
      } as ReturnType<typeof getTenantContext>);
      expect(getTenantBrandName()).toBe("Millionaresmansion");
    });

    it("TASK-7431: Neutral with only personal brandName uses neutral fallback", () => {
      vi.mocked(getTenantContext).mockReturnValue({
        slug: "solo-host",
        name: "",
        brandName: "mahesh wagh",
        guestCommsBrandingMode: "Neutral",
      } as ReturnType<typeof getTenantContext>);
      expect(getTenantBrandName()).toBe(NEUTRAL_NO_BRAND_FALLBACK);
    });
  });

  describe("getTenantContactEmail", () => {
    it("neutral-with-branding: uses the tenant's own configured email unchanged", () => {
      vi.mocked(getTenantContext).mockReturnValue({
        slug: "gaurav",
        name: "Elsiya Loft",
        guestCommsBrandingMode: "Neutral",
        legalContactPack: { contactEmail: "stay@elsiyaloft.example", showAtlasFooterCredit: false, isCustomDomain: false },
      } as ReturnType<typeof getTenantContext>);
      expect(getTenantContactEmail("support")).toBe("stay@elsiyaloft.example");
    });

    it("neutral-no-branding: omits the email (never the Atlas support/privacy address), even off a custom domain", () => {
      vi.mocked(getTenantContext).mockReturnValue({
        slug: "brand-new-tenant",
        name: "",
        guestCommsBrandingMode: "Neutral",
        legalContactPack: { showAtlasFooterCredit: false, isCustomDomain: false },
      } as ReturnType<typeof getTenantContext>);
      expect(getTenantContactEmail("support")).toBe("");
      expect(getTenantContactEmail("privacy")).toBe("");
    });

    it("platform-mode regression: unset email still falls back to the Atlas support/privacy address", () => {
      vi.mocked(getTenantContext).mockReturnValue({
        slug: "atlas",
        name: "Atlastays",
        guestCommsBrandingMode: "Platform",
      } as ReturnType<typeof getTenantContext>);
      expect(getTenantContactEmail("support")).toContain("atlastays.com");
      expect(getTenantContactEmail("privacy")).toContain("atlastays.com");
    });
  });
});
