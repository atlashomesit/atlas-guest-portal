/**
 * Same-origin asset in `public/images/` (avoids private Azure blob 409s in the browser).
 *
 * RA-006 §3.6: This is the brand-neutral *fallback* — used only when the tenant's
 * `tenant.logoUrl` is unset (e.g. cold load before /tenants/from-domain returns,
 * or a brand-new tenant that hasn't uploaded a logo yet). Tenants who have a logo
 * configured will see *their own* logo via `tenant.logoUrl`. The atlas marketplace
 * apex ships its lockup via `TENANT_OVERRIDES.atlas.logoUrl` (`ATLAS_HOMES_LOGO_URL`).
 *
 * Per-tenant logo artwork that ships in this repo (e.g. Stay by City Focus, Atlas Homes)
 * is wired through `TENANT_OVERRIDES[slug].logoUrl` in tenant/tenantOverrides.ts —
 * never through this fallback, which must stay brand-neutral.
 */
export const LOGO_URL = "/images/tenant-logo-placeholder.svg";

/** Marketplace lockup: mountain mark + ATLAS HOMES + tagline. Atlas slug only. */
export const ATLAS_HOMES_LOGO_URL = "/images/atlas-homes-logo.png";

/** True when `src` is a repo-shipped wordmark (already spells the brand; hide duplicate text). */
export function isWordmarkLogo(src: string): boolean {
  return src.includes("stay-bycityfocus") || src.includes("atlas-homes-logo");
}

/** Decorative property-card / gallery designs (theme mockup style) */
export const PROPERTY_DESIGN_IMAGES = [
  "/images/stay-design-coral.svg",
  "/images/stay-design-lavender.svg",
  "/images/stay-design-peach.svg",
] as const;

export const getPropertyDesignImage = (seed: string | number = 0): string => {
  const n = typeof seed === "number" ? seed : Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  return PROPERTY_DESIGN_IMAGES[Math.abs(n) % PROPERTY_DESIGN_IMAGES.length];
};

export const BRANDING = {
  logoUrl: LOGO_URL,
};
