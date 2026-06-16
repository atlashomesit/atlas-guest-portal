import { afterEach, describe, expect, it, vi } from "vitest";
import type { TenantInfo } from "../tenant/tenantContext";

// Drive contact resolution from "API" data by mocking the tenant modules.
vi.mock("../tenant/tenantContext", () => ({ getTenantContext: vi.fn() }));
vi.mock("../tenant/tenantOverrides", () => ({ getTenantOverrides: vi.fn() }));

import {
  getContactPhone,
  getWhatsAppPhone,
  getContactEmail,
  getTelLink,
  getWhatsAppLink,
  formatDisplayNumber,
  hasHostContact,
  isWhiteLabelTenant,
} from "./contact";
import { getTenantContext } from "../tenant/tenantContext";
import { getTenantOverrides } from "../tenant/tenantOverrides";

const ctx = vi.mocked(getTenantContext);
const ovr = vi.mocked(getTenantOverrides);

const ATLAS_DEFAULT = "7032493290";

function tenant(partial: Partial<TenantInfo>): TenantInfo {
  return { name: "Tenant", slug: "tenant", ...partial };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("contact resolution — per-tenant number from the API", () => {
  it("uses the tenant's API contactPhone for the business number, normalised", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(
      tenant({ legalContactPack: { contactPhone: "+919812345678", showAtlasFooterCredit: false } }),
    );
    expect(getContactPhone("business")).toBe("9812345678");
  });

  it("uses the tenant's API whatsappBookingPhone for WhatsApp, stripping the 91 country code", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(tenant({ whatsappBookingPhone: "919812345678" }));
    expect(getWhatsAppPhone("business")).toBe("9812345678");
  });

  it("never leaks the Atlas default when the tenant carries its own number (regression)", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(
      tenant({ slug: "e2e-whitelabel", legalContactPack: { contactPhone: "9812345678", showAtlasFooterCredit: false } }),
    );
    expect(getContactPhone("business")).not.toBe(ATLAS_DEFAULT);
    expect(getContactPhone("business")).toBe("9812345678");
  });

  it("falls back to the Atlas default only when neither override nor API carries a number", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(tenant({ slug: "atlas" }));
    expect(getContactPhone("business")).toBe(ATLAS_DEFAULT);
  });

  it("lets an explicit hardcoded override win over the API value", () => {
    ovr.mockReturnValue({ contact: { businessPhone: "7799779192" } });
    ctx.mockReturnValue(
      tenant({ legalContactPack: { contactPhone: "9812345678", showAtlasFooterCredit: false } }),
    );
    expect(getContactPhone("business")).toBe("7799779192");
  });

  it("normalises assorted host-entered formats to a 10-digit national number", () => {
    ovr.mockReturnValue({});
    for (const raw of ["+91 70324 93290", "917032493290", "07032493290", "7032493290"]) {
      ctx.mockReturnValue(
        tenant({ legalContactPack: { contactPhone: raw, showAtlasFooterCredit: false } }),
      );
      expect(getContactPhone("business")).toBe("7032493290");
    }
  });

  it("rejects an un-normalisable API number and falls back to the default", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(
      tenant({ slug: "atlas" }),
    );
    // Un-normalisable phone on a non-custom-domain → Atlas default
    ctx.mockReturnValue(
      tenant({ legalContactPack: { contactPhone: "12345", showAtlasFooterCredit: false } }),
    );
    expect(getContactPhone("business")).toBe(ATLAS_DEFAULT);
  });
});

// ---------------------------------------------------------------------------
// White-label tenant (isCustomDomain=true) — Atlas defaults MUST NOT leak
// TASK: cross-tenant contact data leak guard
// ---------------------------------------------------------------------------
describe("white-label tenant (isCustomDomain true) — no Atlas defaults must leak", () => {
  it("getContactPhone returns '' when no phone is configured (NOT the Atlas number)", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(
      tenant({ slug: "nightnest", legalContactPack: { isCustomDomain: true, showAtlasFooterCredit: false } }),
    );
    const phone = getContactPhone("business");
    expect(phone).toBe("");
    expect(phone).not.toBe(ATLAS_DEFAULT);
  });

  it("getWhatsAppPhone returns '' when no phone is configured (NOT the Atlas number)", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(
      tenant({ slug: "nightnest", legalContactPack: { isCustomDomain: true, showAtlasFooterCredit: false } }),
    );
    const phone = getWhatsAppPhone("business");
    expect(phone).toBe("");
    expect(phone).not.toBe(ATLAS_DEFAULT);
  });

  it("getContactEmail returns '' when no email is configured (NOT the Atlas email)", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(
      tenant({ slug: "nightnest", legalContactPack: { isCustomDomain: true, showAtlasFooterCredit: false } }),
    );
    const email = getContactEmail();
    expect(email).toBe("");
    expect(email).not.toContain("atlas");
  });

  it("getTelLink returns '' (no recipient-less tel: link)", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(
      tenant({ slug: "nightnest", legalContactPack: { isCustomDomain: true, showAtlasFooterCredit: false } }),
    );
    expect(getTelLink()).toBe("");
  });

  it("getWhatsAppLink returns '' (no recipient-less wa.me link)", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(
      tenant({ slug: "nightnest", legalContactPack: { isCustomDomain: true, showAtlasFooterCredit: false } }),
    );
    expect(getWhatsAppLink()).toBe("");
  });

  it("formatDisplayNumber returns ''", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(
      tenant({ slug: "nightnest", legalContactPack: { isCustomDomain: true, showAtlasFooterCredit: false } }),
    );
    expect(formatDisplayNumber()).toBe("");
  });

  it("hasHostContact returns false", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(
      tenant({ slug: "nightnest", legalContactPack: { isCustomDomain: true, showAtlasFooterCredit: false } }),
    );
    expect(hasHostContact()).toBe(false);
  });

  it("isWhiteLabelTenant returns true", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(
      tenant({ slug: "nightnest", legalContactPack: { isCustomDomain: true, showAtlasFooterCredit: false } }),
    );
    expect(isWhiteLabelTenant()).toBe(true);
  });

  it("when the tenant DOES have a contactPhone, that number wins (no leak, no omission)", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(
      tenant({
        slug: "nightnest",
        legalContactPack: { isCustomDomain: true, showAtlasFooterCredit: false, contactPhone: "9876543210" },
      }),
    );
    expect(getContactPhone("business")).toBe("9876543210");
    expect(hasHostContact()).toBe(true);
  });

  it("Atlas marketplace domain (isCustomDomain false) still gets Atlas defaults", () => {
    ovr.mockReturnValue({});
    ctx.mockReturnValue(
      tenant({ slug: "atlastays", legalContactPack: { isCustomDomain: false, showAtlasFooterCredit: true } }),
    );
    expect(getContactPhone("business")).toBe(ATLAS_DEFAULT);
    expect(isWhiteLabelTenant()).toBe(false);
  });
});
