/**
 * Admin portal base URL for host-acquisition CTAs (marketplace only — TASK-7434).
 * White-label tenants must not render links to this origin.
 */
/* eslint-disable atlas-brand/no-atlas-string-leak -- single canonical fallback for VITE_ADMIN_PORTAL_URL */
const ADMIN_PORTAL_FALLBACK = "https://app.atlaspms.in";

export function getAdminPortalBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_ADMIN_PORTAL_URL as string | undefined)?.trim();
  return fromEnv || ADMIN_PORTAL_FALLBACK;
}

export function getAdminPortalLoginUrl(): string {
  return `${getAdminPortalBaseUrl()}/login`;
}
