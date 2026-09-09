/**
 * TASK-101158: the homepage promo's default subline hardcoded "Pay with UPI or cards via
 * Razorpay" with no rail check. It must resolve through hasOnlinePaymentRail(), and a
 * tenant-authored overrides.directBookingPromo.subline must still win over both variants.
 */

import { describe, it, expect } from "vitest";
import { resolveDirectBookingPromo } from "./directBookingPromo";
import type { TenantInfo } from "../tenant/tenantContext";
import type { TenantOverrides } from "../tenant/tenantOverrides";

const tenant = (over: Partial<TenantInfo>): TenantInfo => ({
  name: "Atlas Homestays",
  slug: "atlas",
  isMarketplaceRoot: true,
  ...over,
});

const noOverrides: TenantOverrides = {};

describe("resolveDirectBookingPromo (TASK-101158)", () => {
  it("WHATSAPP/no-provider tenant: default subline has no Razorpay or UPI claim", () => {
    const resolved = resolveDirectBookingPromo(
      tenant({ paymentProvider: undefined, bookingMode: "WHATSAPP" }),
      noOverrides,
    );
    expect(resolved.sub).not.toMatch(/razorpay/i);
    expect(resolved.sub).not.toMatch(/\bUPI\b/i);
  });

  it("ONLINE tenant: default subline keeps the Razorpay/UPI claim", () => {
    const resolved = resolveDirectBookingPromo(
      tenant({ paymentProvider: "RAZORPAY", bookingMode: "ONLINE" }),
      noOverrides,
    );
    expect(resolved.sub).toMatch(/razorpay/i);
    expect(resolved.sub).toMatch(/\bUPI\b/i);
  });

  it("a tenant-authored subline override wins over the WHATSAPP/no-rail default", () => {
    const resolved = resolveDirectBookingPromo(
      tenant({ paymentProvider: undefined, bookingMode: "WHATSAPP" }),
      { directBookingPromo: { subline: "Custom host-authored subline" } } as TenantOverrides,
    );
    expect(resolved.sub).toBe("Custom host-authored subline");
  });

  it("a tenant-authored subline override wins over the ONLINE default too", () => {
    const resolved = resolveDirectBookingPromo(
      tenant({ paymentProvider: "RAZORPAY", bookingMode: "ONLINE" }),
      { directBookingPromo: { subline: "Custom host-authored subline" } } as TenantOverrides,
    );
    expect(resolved.sub).toBe("Custom host-authored subline");
  });
});
