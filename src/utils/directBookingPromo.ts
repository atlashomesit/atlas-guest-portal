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
import { hasOnlinePaymentRail } from "../tenant/paymentRail";

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
  // TASK-101158: never claim an online payment rail (Razorpay/UPI) that this tenant does not
  // have — mirrors the hasOnlinePaymentRail() gate used by Footer/OwnerShareBadge/etc.
  const sub =
    overrides.directBookingPromo?.subline?.trim() ||
    (hasOnlinePaymentRail(tenant ?? null)
      ? "Pay with UPI or cards via Razorpay. Your price is guaranteed at checkout."
      : "Your price is guaranteed at checkout — no hidden OTA markups.");
  // GUEST-037: no fixed savings percentage here. The only saving shown on a page is one computed
  // from the real quote (struck rate vs total); the homepage hero just states the price promise.
  const savingsStripLine = "Book direct: the price you see is the price you pay.";
  return { show, effectiveDiscountPercent, headline, sub, savingsStripLine };
}

/** Convenience: tenant slug → overrides → resolved promo. */
export function resolveDirectBookingPromoForTenant(tenant: TenantInfo | null | undefined): DirectBookingPromoResolved {
  const overrides = getTenantOverrides(tenant?.slug);
  return resolveDirectBookingPromo(tenant, overrides);
}
