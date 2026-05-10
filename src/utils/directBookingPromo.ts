/**
 * Shared copy and URLs for direct-booking value props (TASK-1293, TASK-1944, TASK-1945).
 */
import { getEffectiveDiscountPercent } from "./pricing";
import {
  getTenantOverrides,
  shouldHideAtlasBranding,
  type TenantOverrides,
} from "../tenant/tenantOverrides";
import type { TenantInfo } from "../tenant/tenantContext";

/** Illustrative OTA guest-side fees (service + payment friction), not a guarantee. */
export const ILLUSTRATIVE_OTA_GUEST_FEE_PERCENT = 18;

/** Marketing deep-link for Airbnb 2026 terms context (TASK-1941 / TASK-1944). */
export const PMS_AIRBNB_2026_TERMS_URL = "https://atlaspms.in/airbnb-2026-tnc";

export type DirectBookingPromoResolved = {
  show: boolean;
  effectiveDiscountPercent: number;
  headline: string;
  sub: string;
  /** One-line strip for hero (below search). */
  savingsStripLine: string;
};

export function resolveDirectBookingPromo(
  tenant: TenantInfo | null | undefined,
  overrides: TenantOverrides,
): DirectBookingPromoResolved {
  const hideAtlasBranding = shouldHideAtlasBranding(tenant, overrides);
  const effectiveDiscountPercent = getEffectiveDiscountPercent();
  const show =
    overrides.directBookingPromo?.enabled === true ||
    (!hideAtlasBranding && overrides.directBookingPromo?.enabled !== false);
  const headline =
    overrides.directBookingPromo?.headline?.trim() ||
    (effectiveDiscountPercent > 0
      ? `Book direct — save up to ${Math.round(effectiveDiscountPercent)}% vs typical booking sites`
      : "Book direct — best rates on our official site");
  const sub =
    overrides.directBookingPromo?.subline?.trim() ||
    "Pay with UPI or cards via Razorpay. Your price is guaranteed at checkout.";
  const savingsStripLine =
    "Booking direct can save you about 18–30% vs typical OTA guest totals (fees and markups vary by site).";
  return { show, effectiveDiscountPercent, headline, sub, savingsStripLine };
}

/** Convenience: tenant slug → overrides → resolved promo. */
export function resolveDirectBookingPromoForTenant(tenant: TenantInfo | null | undefined): DirectBookingPromoResolved {
  const overrides = getTenantOverrides(tenant?.slug);
  return resolveDirectBookingPromo(tenant, overrides);
}
