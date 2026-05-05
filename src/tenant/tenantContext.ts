/**
 * Tenant context for the guest portal.
 * On boot, call resolveFromDomain() first — it calls /tenants/from-domain and sets
 * the tenant slug + brand config without needing X-Tenant-Slug or a known slug.
 * Falls back to validateTenant(slug) if domain resolution fails.
 * The resolved tenant info is stored in-memory and available via getTenantContext().
 */

import { getApiHeaders, buildApiUrl } from '@/api/client';
import { setDomainResolvedSlug } from '@/tenant/tenantResolver';

export interface TenantInfo {
  id?: number;
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor?: string;
  tagline?: string;
  faviconUrl?: string;
  /** @deprecated Use primaryColor */
  brandColor?: string;
  isMarketplaceRoot?: boolean;
  category?: string;
  /** TASK-1727: true when the tenant has a valid GSTIN on file. */
  isGstVerified?: boolean;
  // ── RA-006: TenantBrandPack payment fields ─────────────────────────────────
  /** Active payment provider type (RAZORPAY, UPI_QR, MANUAL…). Undefined = not configured. */
  paymentProvider?: string;
  /** Merchant name to display on payment screens. Falls back to `name` when unset. */
  displayMerchantName?: string;
  /** UPI Virtual Payment Address — populated for UPI_QR / UPI_DEEPLINK providers. */
  upiVpa?: string;
  /** URL of the merchant's QR code image — populated for UPI_QR provider. */
  upiQrAssetUrl?: string;
  /** Guest-facing payment instructions for UPI or Manual providers. */
  upiInstructions?: string;
  /**
   * How guest checkout completes for this tenant:
   *  - "ONLINE"   — Razorpay / UPI inline checkout
   *  - "MANUAL"   — pay-on-arrival; capture booking, skip payment
   *  - "WHATSAPP" — no provider configured; hand off to host's WhatsApp with prefilled booking details
   *  - undefined  — no path to book (no provider, no phone) — show "Bookings opening soon"
   */
  bookingMode?: 'ONLINE' | 'MANUAL' | 'WHATSAPP';
  /** Digits-only WhatsApp number for direct-booking handoff. Always populated when host has a phone. */
  whatsappBookingPhone?: string;
}

let tenantInfo: TenantInfo | null = null;

export function getTenantContext(): TenantInfo | null {
  return tenantInfo;
}

/**
 * Boot-time tenant resolution via domain.
 * Calls GET /tenants/from-domain?domain=<hostname> — no auth, no X-Tenant-Slug needed.
 * On success: stores tenant info + sets the resolved slug for all subsequent API calls.
 * On failure (404 / network error): returns null — caller should fall back to validateTenant().
 */
export async function resolveFromDomain(apiBaseUrl: string, domain: string): Promise<TenantInfo | null> {
  try {
    const url = `${apiBaseUrl.replace(/\/$/, '')}/tenants/from-domain?domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url); // No auth headers — this is the bootstrap endpoint

    if (!res.ok) {
      if (import.meta.env.DEV) {
        console.warn('[tenantContext] resolveFromDomain non-OK response', {
          domain,
          status: res.status,
          url,
        });
      }
      return null;
    }

    const data = await res.json();
    const isMarketplaceRoot = Boolean(data.isMarketplaceRoot);
    const slug = data.tenantSlug as string | null;
    if (!slug && !isMarketplaceRoot) {
      if (import.meta.env.DEV) {
        console.warn('[tenantContext] resolveFromDomain invalid payload shape', {
          domain,
          data,
        });
      }
      return null;
    }

    if (slug) setDomainResolvedSlug(slug);

    tenantInfo = {
      name: data.brandName ?? '',
      slug: slug ?? '',
      logoUrl: data.logoUrl ?? undefined,
      primaryColor: data.primaryColor ?? undefined,
      tagline: data.tagline ?? undefined,
      faviconUrl: data.faviconUrl ?? undefined,
      category: data.category ?? undefined,
      isMarketplaceRoot,
      brandColor: data.primaryColor ?? undefined, // backward compat
      isGstVerified: Boolean(data.isGstVerified), // TASK-1727
      // RA-006: TenantBrandPack payment fields
      paymentProvider: data.paymentProvider ?? undefined,
      displayMerchantName: data.displayMerchantName ?? undefined,
      upiVpa: data.upiVpa ?? undefined,
      upiQrAssetUrl: data.upiQrAssetUrl ?? undefined,
      upiInstructions: data.upiInstructions ?? undefined,
      bookingMode: (data.bookingMode === 'ONLINE' || data.bookingMode === 'MANUAL' || data.bookingMode === 'WHATSAPP')
        ? data.bookingMode
        : undefined,
      whatsappBookingPhone: typeof data.whatsappBookingPhone === 'string' && data.whatsappBookingPhone.length > 0
        ? data.whatsappBookingPhone
        : undefined,
    };
    return tenantInfo;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[tenantContext] resolveFromDomain failed', {
        domain,
        apiBaseUrl,
        error,
      });
    }
    return null; // Network error — caller falls back to validateTenant()
  }
}

/**
 * Validates the tenant slug against the API and stores branding info.
 * Throws if the tenant does not exist or is inactive.
 * Use resolveFromDomain() on boot instead when possible.
 */
export async function validateTenant(slug: string): Promise<TenantInfo> {
  const url = buildApiUrl(`/tenants/${encodeURIComponent(slug)}/public`);
  const res = await fetch(url, { headers: getApiHeaders() });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Tenant "${slug}" not found. Check /.well-known/atlas-runtime-config.json and ensure tenantKey (or ATLAS_TENANT_KEY) is a valid tenant slug.`);
    }
    throw new Error(`Failed to validate tenant "${slug}" (${res.status}).`);
  }

  const data = await res.json();
  tenantInfo = {
    id: data.id,
    name: data.name,
    slug: data.slug,
    logoUrl: data.logoUrl ?? undefined,
    primaryColor: data.brandColor ?? undefined,
    brandColor: data.brandColor ?? undefined,
  };
  return tenantInfo;
}
