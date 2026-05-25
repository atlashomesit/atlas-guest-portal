import { afterEach, describe, expect, it, vi } from "vitest";
import type { TenantInfo } from "../tenant/tenantContext";

// Drive contact resolution from "API" data by mocking the tenant modules.
vi.mock("../tenant/tenantContext", () => ({ getTenantContext: vi.fn() }));
vi.mock("../tenant/tenantOverrides", () => ({ getTenantOverrides: vi.fn() }));

import { getContactPhone, getWhatsAppPhone } from "./contact";
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
      tenant({ slug: "nightnest", legalContactPack: { contactPhone: "9812345678", showAtlasFooterCredit: false } }),
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
      tenant({ legalContactPack: { contactPhone: "12345", showAtlasFooterCredit: false } }),
    );
    expect(getContactPhone("business")).toBe(ATLAS_DEFAULT);
  });
});
