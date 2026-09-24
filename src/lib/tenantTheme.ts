/**
 * TASK-102264 — Tenant website theme customizer (brand colors + typography).
 */

export interface TenantThemeTokens {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isTenantThemeValid(theme: TenantThemeTokens): boolean {
  return HEX_COLOR.test(theme.primaryColor) && HEX_COLOR.test(theme.accentColor) && theme.fontFamily.trim().length > 0;
}

export function tenantThemeCssVars(theme: TenantThemeTokens): Record<string, string> {
  return { '--tenant-primary': theme.primaryColor, '--tenant-accent': theme.accentColor, '--tenant-font': theme.fontFamily };
}

export function tenantThemeDbRow(tenantSlug: string, theme: TenantThemeTokens): Record<string, string> {
  return { tenant_slug: tenantSlug, primary_color: theme.primaryColor, accent_color: theme.accentColor, font_family: theme.fontFamily };
}
