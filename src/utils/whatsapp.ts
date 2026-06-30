import { MARKETPLACE_BRAND_BASELINE } from "@/tenant/displayBrand";

interface BuildWaLinkArgs {
  phoneE164: string;
  text: string;
}

interface DefaultPrefillArgs {
  href?: string;
  context?: string;
  brandName?: string;
}

const normalizePhone = (phoneE164: string) => {
  const digits = phoneE164.replace(/[^\d]/g, "");
  // TASK-4300: callers pass CONTACT.business.whatsapp, a 10-digit Indian national number,
  // into this "phoneE164" slot. wa.me needs the full international form, so prepend 91 when
  // we receive a bare 10-digit national number (leave already-prefixed numbers untouched).
  return digits.length === 10 ? `91${digits}` : digits;
};

export const buildWaLink = ({ phoneE164, text }: BuildWaLinkArgs) => {
  const normalizedPhone = normalizePhone(phoneE164);
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${normalizedPhone}${encodedText ? `?text=${encodedText}` : ""}`;
};

export const defaultPrefill = ({ href, context, brandName = MARKETPLACE_BRAND_BASELINE }: DefaultPrefillArgs) => {
  const pageUrl = href || (typeof window !== "undefined" ? window.location.href : "");
  const contextText = context ? ` and I have a question about: ${context}` : "";
  return `Hi ${brandName} 👋 I'm reading the FAQ${contextText}. Page: ${pageUrl}`.trim();
};
