/**
 * Same-origin asset in `public/images/` (avoids private Azure blob 409s in the browser).
 *
 * RA-006 §3.6: This is the brand-neutral *fallback* — used only when the tenant's
 * `tenant.logoUrl` is unset (e.g. cold load before /tenants/from-domain returns,
 * or a brand-new tenant that hasn't uploaded a logo yet). Tenants who have a logo
 * configured will see *their own* logo via `tenant.logoUrl`. The atlas marketplace
 * apex sets its logo via the API, so users on atlastays.com still see the Atlas brand.
 */
export const LOGO_URL = "/images/tenant-logo-placeholder.svg";

export const BRANDING = {
    logoUrl: LOGO_URL,
};
