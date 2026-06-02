/* CPO-001: MARKETPLACE_BRAND_BASELINE is the single canonical marketplace name; use getTenantBrandName() in UI. */
import { getTenantContext } from "./tenantContext";

/** Canonical marketplace name when no tenant is resolved (apex / atlas tenant). */
export const MARKETPLACE_BRAND_BASELINE = "Atlastays";

/** Marketplace support inbox when the tenant has not supplied `legalContactPack.contactEmail`. */
const MARKETPLACE_SUPPORT_EMAIL = "support@atlastays.com";

/** Marketplace privacy inbox when the tenant has not supplied a contact email. */
const MARKETPLACE_PRIVACY_EMAIL = "privacy@atlastays.com";

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
 * Marketplace apex uses the full baseline so copy reads "Atlastays"; whitelabel
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

/** Placeholder in static SEO/city/blog templates — resolved at render (CPO-001). */
export const TENANT_BRAND_PLACEHOLDER = "{{TENANT_BRAND}}";

/** Legacy marketplace name still present in static SEO/city copy (CPO-001 follow-up). */
// eslint-disable-next-line atlas-brand/no-atlas-string-leak -- intentional legacy token for runtime substitution
const LEGACY_MARKETPLACE_BRAND_IN_COPY = "Atlas Homestays";

/** Replace hardcoded legacy brand strings in static templates with the resolved tenant brand. */
export function withTenantBrandInCopy(text: string): string {
  const brand = getTenantBrandName();
  let out = text;
  if (out.includes(TENANT_BRAND_PLACEHOLDER)) {
    out = out.replaceAll(TENANT_BRAND_PLACEHOLDER, brand);
  }
  if (out.includes(LEGACY_MARKETPLACE_BRAND_IN_COPY)) {
    out = out.replaceAll(LEGACY_MARKETPLACE_BRAND_IN_COPY, brand);
  }
  return out;
}
