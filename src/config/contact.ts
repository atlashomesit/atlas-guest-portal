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

export function getContactPhone(channel: ContactChannel = "business"): string {
  const overrides = tenantContact();
  if (channel === "owner") {
    return overrides?.ownerPhone ?? DEFAULT_OWNER_PHONE;
  }
  return overrides?.businessPhone ?? DEFAULT_BUSINESS_PHONE;
}

export function getWhatsAppPhone(channel: ContactChannel = "business"): string {
  const overrides = tenantContact();
  if (channel === "business" && overrides?.whatsappPhone) {
    return overrides.whatsappPhone;
  }
  return getContactPhone(channel);
}

export function getContactEmail(): string {
  return tenantContact()?.email ?? DEFAULT_EMAIL;
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
