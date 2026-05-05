/* eslint-disable atlas-brand/no-atlas-string-leak -- single canonical marketplace baseline string (CPO-001); use getTenantBrandName() in UI. */
import { getTenantContext } from "./tenantContext";

/** Canonical marketplace name when no tenant is resolved (apex / atlas tenant). */
export const MARKETPLACE_BRAND_BASELINE = "Atlas Homestays";

/** @deprecated Prefer MARKETPLACE_BRAND_BASELINE — kept for call sites using DEFAULT_TENANT_BRAND_NAME. */
export const DEFAULT_TENANT_BRAND_NAME = MARKETPLACE_BRAND_BASELINE;

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
