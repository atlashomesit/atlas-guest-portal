/* eslint-disable atlas-brand/no-atlas-string-leak -- single canonical marketplace baseline string (CPO-001); use getTenantBrandName() in UI. */
import { getTenantContext } from "./tenantContext";

/** Canonical marketplace name when no tenant is resolved (apex / atlas tenant). */
export const MARKETPLACE_BRAND_BASELINE = "Atla Stays";

/** Marketplace support inbox when the tenant has not supplied `legalContactPack.contactEmail`. */
const MARKETPLACE_SUPPORT_EMAIL = "support@atlashomestays.com";

/** Marketplace privacy inbox when the tenant has not supplied a contact email. */
const MARKETPLACE_PRIVACY_EMAIL = "privacy@atlashomestays.com";

/** @deprecated Prefer MARKETPLACE_BRAND_BASELINE — kept for call sites using DEFAULT_TENANT_BRAND_NAME. */
export const DEFAULT_TENANT_BRAND_NAME = MARKETPLACE_BRAND_BASELINE;

/**
 * Guest-visible contact email: tenant `legalContactPack.contactEmail` when set (white-label),
 * otherwise the marketplace default for support vs privacy flows.
 */
export function getTenantContactEmail(kind: "support" | "privacy" = "support"): string {
  const fromPack = getTenantContext()?.legalContactPack?.contactEmail?.trim();
  if (fromPack) return fromPack;
  return kind === "privacy" ? MARKETPLACE_PRIVACY_EMAIL : MARKETPLACE_SUPPORT_EMAIL;
}

/** Short brand for headers, SEO, and guest-facing copy (maps to API `brandName` / `TenantInfo.name`). */
export function getTenantBrandName(): string {
  const c = getTenantContext();
  const raw = (c?.brandName ?? c?.name ?? "").trim();
  return raw || MARKETPLACE_BRAND_BASELINE;
}

/** Legal-entity style name; falls back to short brand. */
export function getTenantBrandNameLong(): string {
  const c = getTenantContext();
  const raw = (c?.brandNameLong ?? c?.legalContactPack?.legalName ?? "").trim();
  return raw || getTenantBrandName();
}

/**
 * Entity name in the short booking-consent line ("I agree to … processing my data").
 * Marketplace apex uses the full baseline so copy reads "Atlas Homestays"; whitelabel
 * tenants use legal/long brand from context (RA-006/AC-5).
 */
export function getGuestDataProcessingEntityName(): string {
  const c = getTenantContext();
  const slug = (c?.slug ?? "").trim().toLowerCase();
  if (slug === "atlas" || Boolean(c?.isMarketplaceRoot)) {
    return MARKETPLACE_BRAND_BASELINE;
  }
  return getTenantBrandNameLong();
}
