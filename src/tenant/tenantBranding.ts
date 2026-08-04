/**
 * Applies tenant brand config (logo, title, primaryColor, favicon) to the DOM.
 * Called after resolveFromDomain() or validateTenant() on boot.
 * Gracefully falls back to Atlas defaults when brand fields are null.
 */

import type { TenantInfo } from './tenantContext';
import {
  MARKETPLACE_BRAND_BASELINE,
  NEUTRAL_NO_BRAND_FALLBACK,
  resolveTenantBrandName,
} from './displayBrand';
import { getTenantOverrides } from './tenantOverrides';

let manifestObjectUrl: string | null = null;

/**
 * TASK-4899: brand-neutral fallback for document title / apple-mobile-web-app-title /
 * PWA manifest name when a tenant has no `brandName`/`name` at all. A `Neutral`-mode tenant
 * gets the generic property-only fallback; every other tenant (Platform mode, or a tenant
 * whose Neutral status the API hasn't shipped yet) keeps today's `MARKETPLACE_BRAND_BASELINE`.
 */
function resolveNoBrandFallback(tenant: TenantInfo): string {
  return tenant.guestCommsBrandingMode === 'Neutral' ? NEUTRAL_NO_BRAND_FALLBACK : MARKETPLACE_BRAND_BASELINE;
}

/** Rejects non-hex brand strings from the API so CSS variables are never injected with arbitrary values. */
function isSafeBrandHex(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

/** Parse a CSS hex color (#RRGGBB or #RGB) to "R G B" space-separated for CSS vars. */
function hexToRgbString(hex: string): string | null {
  const clean = hex.replace('#', '');
  let r: number, g: number, b: number;

  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  } else {
    return null;
  }

  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return `${r} ${g} ${b}`;
}

/** Slightly darken an RGB string for hover states. */
function darkenRgb(rgb: string, amount = 20): string {
  const parts = rgb.split(' ').map(Number);
  return parts.map(v => Math.max(0, v - amount)).join(' ');
}

export function applyTenantBranding(tenant: TenantInfo): void {
  // 1. Document title — TASK-7431: shared displayBrand precedence (business name over person name)
  const docTitle = resolveTenantBrandName(tenant) || resolveNoBrandFallback(tenant);
  document.title = docTitle;

  // 2. Primary color — apply to CSS RGB variables used by Tailwind and CSS custom props
  const brandHex = tenant.primaryColor?.trim();
  if (brandHex && isSafeBrandHex(brandHex)) {
    const rgbStr = hexToRgbString(brandHex);
    if (rgbStr) {
      const root = document.documentElement;
      root.style.setProperty('--cta-primary-rgb', rgbStr);
      root.style.setProperty('--cta-primary-hover-rgb', darkenRgb(rgbStr));
      root.style.setProperty('--accent-primary-rgb', rgbStr);
      root.style.setProperty('--accent-primary', brandHex);
      // Also set --color-primary for any components using it directly
      root.style.setProperty('--color-primary', brandHex);
      // TASK-1688: --brand-primary used in navbar.css and other white-label components
      root.style.setProperty('--brand-primary', brandHex);
      root.style.setProperty('--brand-soft', `rgba(${rgbStr.replace(/ /g, ',')},0.12)`);
    }
  }

  // Repo-shipped per-tenant brand assets (tenantOverrides.ts) win over API values
  // so same-origin artwork stays pixel-exact for that slug only.
  const overrides = getTenantOverrides(tenant.slug);

  // 3a. Logo URL — set as CSS variable for components that reference it
  const logoUrl = overrides.logoUrl ?? tenant.logoUrl;
  if (logoUrl) {
    document.documentElement.style.setProperty('--brand-logo-url', `url("${logoUrl}")`);
  }

  // 4. Favicon
  const faviconUrl = overrides.faviconUrl ?? tenant.faviconUrl;
  if (faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
  }

  applyTenantWebManifest(tenant);
  applyAppleWebAppTitle(tenant);
}

function applyAppleWebAppTitle(tenant: TenantInfo): void {
  // TASK-7431: same business-name precedence as header / <title>
  const short = resolveTenantBrandName(tenant) || resolveNoBrandFallback(tenant);
  const appleTitle = short.length > 12 ? short.slice(0, 12) : short;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "apple-mobile-web-app-title";
    document.head.appendChild(meta);
  }
  meta.content = appleTitle;
}

/** Per-tenant PWA manifest name (CPO-001 / module #14). */
function applyTenantWebManifest(tenant: TenantInfo): void {
  if (typeof document === 'undefined' || typeof fetch === 'undefined') return;

  // TASK-7431: PWA name follows business-name precedence, not raw brandName
  const displayName = resolveTenantBrandName(tenant) || resolveNoBrandFallback(tenant);
  const shortName = displayName.length > 12 ? `${displayName.slice(0, 12)}…` : displayName;

  void fetch('/manifest.webmanifest')
    .then((res) => (res.ok ? res.json() : null))
    .then((base: Record<string, unknown> | null) => {
      if (!base || typeof base !== 'object') return;
      const merged = {
        ...base,
        name: displayName,
        short_name: shortName,
        description: `Direct booking with ${displayName} — verified homestays and serviced apartments.`,
      };
      if (manifestObjectUrl) {
        URL.revokeObjectURL(manifestObjectUrl);
        manifestObjectUrl = null;
      }
      manifestObjectUrl = URL.createObjectURL(
        new Blob([JSON.stringify(merged)], { type: 'application/manifest+json' }),
      );
      let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'manifest';
        document.head.appendChild(link);
      }
      link.href = manifestObjectUrl;
    })
    .catch(() => {
      /* offline / missing manifest — keep static file */
    });
}
