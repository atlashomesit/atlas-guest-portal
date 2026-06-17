/**
 * Tenant context for the guest portal.
 * On boot, call resolveFromDomain() first — it calls /tenants/from-domain and sets
 * the tenant slug + brand config without needing X-Tenant-Slug or a known slug.
 * Falls back to validateTenant(slug) if domain resolution fails.
 * The resolved tenant info is stored in-memory and available via getTenantContext().
 */

import { getApiHeaders, buildApiUrl } from '@/api/client';
import { setDomainResolvedSlug, setMarketplaceMode } from '@/tenant/tenantResolver';

export interface TenantInfo {
  id?: number;
  /** API `brandName` — short name for UI (e.g. Star Guest House). */
  name: string;
  /** CPO-001: explicit short brand; mirrors `name` when resolved from `/tenants/from-domain`. */
  brandName?: string;
  /** CPO-001: legal-entity line when available (e.g. from `legalContactPack.legalName`). */
  brandNameLong?: string;
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
  /** TL-API: Map pin coordinates for the location page, set by the host via the admin portal picker.
   *  Undefined when the host has not configured a location yet — caller falls back to tenantOverrides. */
  mapLocation?: {
    lat: number;
    lng: number;
    zoom?: number;
    markerLabel?: string;
  };
  /** TL-API: Location page content (transport, amenities, landmarks) from admin portal.
   *  Undefined when not configured — caller falls back to tenantOverrides. */
  locationContent?: {
    subtitle?: string;
    transport?: Array<{ title: string; details: string }>;
    nearbyAmenities?: Array<{ title: string; details: string }>;
    landmarks?: Array<{ title: string; details: string }>;
  };
  /**
   * RA-006 §3.5: legal + contact identity used by tenant-aware privacy notices, terms,
   * footer rows, and consent text. Any field can be undefined when the host hasn't filled
   * it in; consumers should pair each read with a brand-neutral fallback.
   */
  legalContactPack?: TenantLegalContactPack;
}

/** RA-006 §3.5: legal/contact identity returned by /tenants/from-domain.LegalContactPack. */
export interface TenantLegalContactPack {
  legalName?: string;
  displayName?: string;
  contactEmail?: string;
  contactPhone?: string;
  registeredAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  /** When true, the guest portal renders a small powered-by footer credit for the marketplace operator. */
  showAtlasFooterCredit: boolean;
  /**
   * TASK-4161: True when the tenant was resolved via a custom domain (or branded subdomain)
   * rather than the Atlas default domain set. The guest portal uses this to conditionally render
   * Consumer Protection E-Commerce Rules 2020 disclosures: merchant-of-record name, grievance
   * contact, booking-engine credit, and Razorpay on-behalf-of line.
   */
  isCustomDomain: boolean;
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
/**
 * TASK-2642: thrown by resolveFromDomain when the host resolves to a real tenant slug whose
 * branded subdomain is NOT activated (no WEBSITE add-on). Boot catches this to render a
 * brand-neutral "site not set up" page instead of falling back to the Atlas-branded default.
 */
export class SubdomainNotActivatedError extends Error {
  constructor() {
    super('SUBDOMAIN_NOT_ACTIVATED');
    this.name = 'SubdomainNotActivatedError';
  }
}

export async function resolveFromDomain(apiBaseUrl: string, domain: string): Promise<TenantInfo | null> {
  try {
    // Dev + browser: same-origin /tenants is proxied by Vite — avoids CORS failures on
    // *.localhost whitelabel hosts (e2e-wa-only.localhost) that would fall back to tenantKey.
    const url =
      import.meta.env.DEV && typeof window !== 'undefined'
        ? `/tenants/from-domain?domain=${encodeURIComponent(domain)}`
        : `${apiBaseUrl.replace(/\/$/, '')}/tenants/from-domain?domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url); // No auth headers — this is the bootstrap endpoint

    if (!res.ok) {
      // TASK-2642: a 404 SUBDOMAIN_NOT_ACTIVATED means the slug is a real tenant that hasn't bought
      // the WEBSITE add-on. Surface it distinctly so boot does NOT fall back to validateTenant()
      // (which would render Atlas branding on a stranger's branded subdomain).
      if (res.status === 404) {
        try {
          const body = await res.json();
          if (body?.error === 'SUBDOMAIN_NOT_ACTIVATED') {
            throw new SubdomainNotActivatedError();
          }
        } catch (bodyErr) {
          if (bodyErr instanceof SubdomainNotActivatedError) throw bodyErr;
          // Non-JSON body / parse failure → fall through to the null return below.
        }
      }
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
    if (isMarketplaceRoot) setMarketplaceMode(true);

    const brandShort = String(data.brandName ?? "").trim();
    const brandLong =
      typeof data.legalContactPack?.legalName === "string" ? data.legalContactPack.legalName.trim() : "";

    tenantInfo = {
      name: brandShort,
      brandName: brandShort || undefined,
      brandNameLong: brandLong || undefined,
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
      mapLocation: (data.mapLocation && typeof data.mapLocation.lat === 'number' && typeof data.mapLocation.lng === 'number')
        ? {
            lat: data.mapLocation.lat,
            lng: data.mapLocation.lng,
            zoom: typeof data.mapLocation.zoom === 'number' ? data.mapLocation.zoom : undefined,
            markerLabel: typeof data.mapLocation.markerLabel === 'string' && data.mapLocation.markerLabel.length > 0
              ? data.mapLocation.markerLabel
              : undefined,
          }
        : undefined,
      locationContent: data.locationContent
        ? {
            subtitle: typeof data.locationContent.subtitle === 'string' ? data.locationContent.subtitle : undefined,
            transport: Array.isArray(data.locationContent.transport) ? data.locationContent.transport : undefined,
            nearbyAmenities: Array.isArray(data.locationContent.nearbyAmenities) ? data.locationContent.nearbyAmenities : undefined,
            landmarks: Array.isArray(data.locationContent.landmarks) ? data.locationContent.landmarks : undefined,
          }
        : undefined,
      legalContactPack: data.legalContactPack
        ? {
            legalName: typeof data.legalContactPack.legalName === 'string' ? data.legalContactPack.legalName : undefined,
            displayName: typeof data.legalContactPack.displayName === 'string' ? data.legalContactPack.displayName : undefined,
            contactEmail: typeof data.legalContactPack.contactEmail === 'string' ? data.legalContactPack.contactEmail : undefined,
            contactPhone: typeof data.legalContactPack.contactPhone === 'string' ? data.legalContactPack.contactPhone : undefined,
            registeredAddress: typeof data.legalContactPack.registeredAddress === 'string' ? data.legalContactPack.registeredAddress : undefined,
            city: typeof data.legalContactPack.city === 'string' ? data.legalContactPack.city : undefined,
            state: typeof data.legalContactPack.state === 'string' ? data.legalContactPack.state : undefined,
            pincode: typeof data.legalContactPack.pincode === 'string' ? data.legalContactPack.pincode : undefined,
            gstin: typeof data.legalContactPack.gstin === 'string' ? data.legalContactPack.gstin : undefined,
            showAtlasFooterCredit: Boolean(data.legalContactPack.showAtlasFooterCredit),
            isCustomDomain: Boolean(data.legalContactPack.isCustomDomain),
          }
        : undefined,
    };
    return tenantInfo;
  } catch (error) {
    // TASK-2642: propagate the not-activated signal; never swallow it into the null fallback.
    if (error instanceof SubdomainNotActivatedError) throw error;
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
  const nm = String(data.name ?? "").trim();
  tenantInfo = {
    id: data.id,
    name: nm,
    brandName: nm || undefined,
    brandNameLong: undefined,
    slug: data.slug,
    logoUrl: data.logoUrl ?? undefined,
    primaryColor: data.brandColor ?? undefined,
    brandColor: data.brandColor ?? undefined,
    mapLocation: (data.mapLocation && typeof data.mapLocation.lat === 'number' && typeof data.mapLocation.lng === 'number')
      ? {
          lat: data.mapLocation.lat,
          lng: data.mapLocation.lng,
          zoom: typeof data.mapLocation.zoom === 'number' ? data.mapLocation.zoom : undefined,
          markerLabel: typeof data.mapLocation.markerLabel === 'string' ? data.mapLocation.markerLabel : undefined,
        }
      : undefined,
    locationContent: data.locationContent
      ? {
          subtitle: typeof data.locationContent.subtitle === 'string' ? data.locationContent.subtitle : undefined,
          transport: Array.isArray(data.locationContent.transport) ? data.locationContent.transport : undefined,
          nearbyAmenities: Array.isArray(data.locationContent.nearbyAmenities) ? data.locationContent.nearbyAmenities : undefined,
          landmarks: Array.isArray(data.locationContent.landmarks) ? data.locationContent.landmarks : undefined,
        }
      : undefined,
  };
  return tenantInfo;
}
