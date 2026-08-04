/* CPO-001: MARKETPLACE_BRAND_BASELINE is the single canonical marketplace name; use getTenantBrandName() in UI. */
import { getTenantContext } from "./tenantContext";

/** Canonical marketplace name when no tenant is resolved (apex / atlas tenant). */
export const MARKETPLACE_BRAND_BASELINE = "Atlastays";

// eslint-disable-next-line atlas-brand/no-atlas-string-leak -- marketplace-only fallback; getTenantContactEmail() guards against leaking this to white-label tenants
const MARKETPLACE_SUPPORT_EMAIL = "support@atlastays.com";

// eslint-disable-next-line atlas-brand/no-atlas-string-leak -- marketplace-only fallback; getTenantContactEmail() guards against leaking this to white-label tenants
const MARKETPLACE_PRIVACY_EMAIL = "privacy@atlastays.com";

/** @deprecated Prefer MARKETPLACE_BRAND_BASELINE — kept for call sites using DEFAULT_TENANT_BRAND_NAME. */
export const DEFAULT_TENANT_BRAND_NAME = MARKETPLACE_BRAND_BASELINE;

/**
 * TASK-4899: true when the resolved tenant is in `Neutral` guest-comms branding mode
 * (`TenantProfile.GuestCommsBrandingMode` — every tenant except Atlas's own `TenantId=1`,
 * per TASK-4894/ADR-0080). This is the axis unconfigured-branding fallbacks must check before
 * showing an Atlas mark. `undefined` (field not yet resolved, or the API hasn't shipped it —
 * see `TenantInfo.guestCommsBrandingMode`'s doc comment) is intentionally NOT treated as
 * Neutral: callers keep today's (Platform-shaped) fallback rather than guessing.
 */
export function isNeutralBrandingMode(): boolean {
  return getTenantContext()?.guestCommsBrandingMode === "Neutral";
}

/**
 * TASK-4899: brand-neutral fallback used only for a `Neutral`-mode tenant with zero
 * configured branding (no `brandName`/`name` at all from the API). Never resolves to an
 * Atlas mark — contrast with `MARKETPLACE_BRAND_BASELINE`, which remains the correct
 * fallback for Platform mode (Atlas's own tenant) and for every case where Neutral mode
 * can't be confirmed.
 */
export const NEUTRAL_NO_BRAND_FALLBACK = "Your Stay";

/**
 * Guest-visible contact email: tenant `legalContactPack.contactEmail` when set (white-label),
 * otherwise the marketplace default for support vs privacy flows.
 * RA-006: returns "" on a white-label tenant with no configured email so callers
 * can hide the contact row rather than showing an Atlas platform address.
 * TASK-4899: also returns "" for a `Neutral`-mode tenant with no configured email, even when
 * accessed via a non-custom-domain host (e.g. before DNS/subdomain cutover) — the branding
 * mode is the authoritative "don't leak the platform address" signal going forward.
 */
export function getTenantContactEmail(kind: "support" | "privacy" = "support"): string {
  const ctx = getTenantContext();
  const fromPack = ctx?.legalContactPack?.contactEmail?.trim();
  if (fromPack) return fromPack;
  // Never fall back to the Atlas marketplace email on a white-label custom domain,
  // or on a Neutral-mode tenant regardless of domain shape.
  const isWhiteLabel = Boolean(ctx?.legalContactPack?.isCustomDomain);
  if (isWhiteLabel || isNeutralBrandingMode()) return "";
  return kind === "privacy" ? MARKETPLACE_PRIVACY_EMAIL : MARKETPLACE_SUPPORT_EMAIL;
}

/**
 * Short brand for headers, SEO, and guest-facing copy.
 *
 * TASK-7431 precedence (business name first):
 *  1. `legalContactPack.displayName` — host-configured business display name
 *  2. `brandNameLong` — legal/property-style long brand when no business display name
 *  3. `brandName` / `name` — short API brand only when neither of the above is set
 *  4. Neutral → `NEUTRAL_NO_BRAND_FALLBACK`; otherwise `MARKETPLACE_BRAND_BASELINE`
 *
 * TASK-4899: a `Neutral`-mode tenant with nothing configured falls back to
 * `NEUTRAL_NO_BRAND_FALLBACK`, never `MARKETPLACE_BRAND_BASELINE` ("Atlastays").
 */
export function getTenantBrandName(): string {
  const c = getTenantContext();
  // Prefer the host's business display name over short API brand / marketplace defaults.
  const businessDisplay = (c?.legalContactPack?.displayName ?? "").trim();
  if (businessDisplay) return businessDisplay;
  const longBrand = (c?.brandNameLong ?? "").trim();
  if (longBrand) return longBrand;
  const raw = (c?.brandName ?? c?.name ?? "").trim();
  if (raw) return raw;
  return isNeutralBrandingMode() ? NEUTRAL_NO_BRAND_FALLBACK : MARKETPLACE_BRAND_BASELINE;
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
