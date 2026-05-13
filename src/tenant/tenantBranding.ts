/**
 * Applies tenant brand config (logo, title, primaryColor, favicon) to the DOM.
 * Called after resolveFromDomain() or validateTenant() on boot.
 * Gracefully falls back to Atlas defaults when brand fields are null.
 */

import type { TenantInfo } from './tenantContext';

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
  // 1. Document title — guard against whitespace-only name (WCAG: title must be non-empty)
  if (tenant.name?.trim()) {
    document.title = tenant.name.trim();
  }

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

  // 3a. Logo URL — set as CSS variable for components that reference it
  if (tenant.logoUrl) {
    document.documentElement.style.setProperty('--brand-logo-url', `url("${tenant.logoUrl}")`);
  }

  // 4. Favicon
  if (tenant.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = tenant.faviconUrl;
  }
}
