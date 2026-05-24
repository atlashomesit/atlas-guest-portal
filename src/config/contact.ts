import { getTenantContext } from '../tenant/tenantContext';
import { getTenantOverrides } from '../tenant/tenantOverrides';

export type ContactChannel = "business" | "owner";

const DEFAULT_BUSINESS_PHONE = "7032493290";
const DEFAULT_OWNER_PHONE = "9177773290";
const DEFAULT_EMAIL = "atlashomeskphb@gmail.com";

function tenantContact() {
  const slug = getTenantContext()?.slug;
  return getTenantOverrides(slug).contact;
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
    return overrides?.ownerPhone ?? DEFAULT_OWNER_PHONE;
  }
  // Precedence: explicit override → the tenant's own number from the API →
  // Atlas default. The API value (host's admin-profile phone) MUST win over the
  // default, otherwise every tenant without a hardcoded override would show the
  // Atlas marketplace number to its own guests.
  if (overrides?.businessPhone) return overrides.businessPhone;
  const fromApi = toNationalDigits(getTenantContext()?.legalContactPack?.contactPhone);
  return fromApi ?? DEFAULT_BUSINESS_PHONE;
}

export function getWhatsAppPhone(channel: ContactChannel = "business"): string {
  const overrides = tenantContact();
  if (channel === "business") {
    if (overrides?.whatsappPhone) return overrides.whatsappPhone;
    const fromApi = toNationalDigits(getTenantContext()?.whatsappBookingPhone);
    if (fromApi) return fromApi;
  }
  return getContactPhone(channel);
}

export function getContactEmail(): string {
  const override = tenantContact()?.email?.trim();
  if (override) return override;
  const fromApi = getTenantContext()?.legalContactPack?.contactEmail?.trim();
  if (fromApi) return fromApi;
  return DEFAULT_EMAIL;
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
  return `tel:+91${getContactPhone(channel)}`;
}

export function getWhatsAppLink(channel: ContactChannel = DEFAULT_CONTACT_CHANNEL) {
  return `https://wa.me/${getWhatsAppPhone(channel)}`;
}

export function formatDisplayNumber(channel: ContactChannel = DEFAULT_CONTACT_CHANNEL) {
  return `+91-${getContactPhone(channel)}`;
}
