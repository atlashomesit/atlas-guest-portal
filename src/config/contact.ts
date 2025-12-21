export type ContactChannel = "business" | "owner";

export const CONTACT = {
  business: {
    phone: "7032493290",
    whatsapp: "7032493290",
    label: "Business contact",
  },
  owner: {
    phone: "9177773290",
    whatsapp: "9177773290",
    label: "Owner (escalation only)",
  },
} as const;

export const DEFAULT_CONTACT_CHANNEL: ContactChannel = "business";

export function getTelLink(channel: ContactChannel = DEFAULT_CONTACT_CHANNEL) {
  return `tel:+91${CONTACT[channel].phone}`;
}

export function getWhatsAppLink(channel: ContactChannel = DEFAULT_CONTACT_CHANNEL) {
  return `https://wa.me/${CONTACT[channel].whatsapp}`;
}

export function formatDisplayNumber(channel: ContactChannel = DEFAULT_CONTACT_CHANNEL) {
  return `+91-${CONTACT[channel].phone}`;
}
