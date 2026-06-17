import { getTenantContext } from '../tenant/tenantContext';
import { getTenantOverrides } from '../tenant/tenantOverrides';

export type ContactChannel = "business" | "owner";

// eslint-disable-next-line atlas-brand/no-atlas-string-leak -- canonical marketplace fallback; getContactPhone() guards against leaking to white-label tenants (returns "" when isWhiteLabelTenant())
const DEFAULT_BUSINESS_PHONE = "7032493290";
const DEFAULT_OWNER_PHONE = "9177773290";
// eslint-disable-next-line atlas-brand/no-atlas-string-leak -- canonical marketplace fallback; getContactEmail() guards against leaking to white-label tenants (returns "" when isWhiteLabelTenant())
const DEFAULT_EMAIL = "atlashomeskphb@gmail.com";

function tenantContact() {
  const slug = getTenantContext()?.slug;
  return getTenantOverrides(slug).contact;
}

/**
 * True for a white-label tenant resolved via its own custom domain / branded subdomain.
 * For these tenants the Atlas marketplace phone/email MUST NEVER appear as the host contact —
 * that is a cross-tenant leak. The DEFAULT_* platform values below are only valid on the
 * Atlas default/marketplace domain (isCustomDomain falsey).
 */
export function isWhiteLabelTenant(): boolean {
  return Boolean(getTenantContext()?.legalContactPack?.isCustomDomain);
}

/**
 * Reduce a host-entered or API phone to a 10-digit Indian national number,
 * dropping +91 / leading 91 / leading 0 and any spaces, dashes or punctuation.
 * Returns null when the input can't be reduced to a clean 10-digit number so
 * callers fall back to the next source.
 */
function toNationalDigits(raw?: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length === 10 ? d : null;
}

export function getContactPhone(channel: ContactChannel = "business"): string {
  const overrides = tenantContact();
  if (channel === "owner") {
    // For white-label tenants, never fall back to the Atlas owner number.
    return overrides?.ownerPhone ?? (isWhiteLabelTenant() ? "" : DEFAULT_OWNER_PHONE);
  }
  // Precedence: explicit override → the tenant's own number from the API →
  // Atlas default (marketplace only — never on a white-label custom domain).
  // The API value (host's admin-profile phone) MUST win over the default,
  // otherwise every tenant without a hardcoded override would show the
  // Atlas marketplace number to its own guests.
  if (overrides?.businessPhone) return overrides.businessPhone;
  const fromApi = toNationalDigits(getTenantContext()?.legalContactPack?.contactPhone);
  return fromApi ?? (isWhiteLabelTenant() ? "" : DEFAULT_BUSINESS_PHONE);
}

export function getWhatsAppPhone(channel: ContactChannel = "business"): string {
  const overrides = tenantContact();
  if (channel === "business") {
    if (overrides?.whatsappPhone) return overrides.whatsappPhone;
    const fromApi = toNationalDigits(getTenantContext()?.whatsappBookingPhone);
    if (fromApi) return fromApi;
  }
  // Falls through to getContactPhone which itself applies the white-label guard.
  return getContactPhone(channel);
}

export function getContactEmail(): string {
  const override = tenantContact()?.email?.trim();
  if (override) return override;
  const fromApi = getTenantContext()?.legalContactPack?.contactEmail?.trim();
  if (fromApi) return fromApi;
  // Never leak the Atlas platform email to a white-label tenant's guests.
  return isWhiteLabelTenant() ? "" : DEFAULT_EMAIL;
}

/**
 * Returns true when the resolved contact phone for the given channel is non-empty.
 * Use this to conditionally render phone/WhatsApp CTAs — returning false means
 * no number is available (white-label tenant with no configured phone, or empty
 * override) and the CTA should be hidden rather than pointing to a blank wa.me link.
 */
export function hasHostContact(channel: ContactChannel = "business"): boolean {
  return getContactPhone(channel).length > 0;
}

/**
 * Lazy view of contact info. `CONTACT.business.phone` reads the tenant
 * override at access time, so consumers inside React render functions
 * pick up the resolved tenant value automatically.
 */
export const CONTACT = {
  get business() {
    return {
      phone: getContactPhone("business"),
      whatsapp: getWhatsAppPhone("business"),
      label: "Business contact",
    };
  },
  get owner() {
    return {
      phone: getContactPhone("owner"),
      whatsapp: getWhatsAppPhone("owner"),
      label: "Owner (escalation only)",
    };
  },
} as const;

export const DEFAULT_CONTACT_CHANNEL: ContactChannel = "business";

export function getTelLink(channel: ContactChannel = DEFAULT_CONTACT_CHANNEL) {
  const p = getContactPhone(channel);
  return p ? `tel:+91${p}` : "";
}

export function getWhatsAppLink(channel: ContactChannel = DEFAULT_CONTACT_CHANNEL) {
  const p = getWhatsAppPhone(channel);
  return p ? `https://wa.me/${p}` : "";
}

export function formatDisplayNumber(channel: ContactChannel = DEFAULT_CONTACT_CHANNEL) {
  const p = getContactPhone(channel);
  return p ? `+91-${p}` : "";
}
