interface BuildWaLinkArgs {
  phoneE164: string;
  text: string;
}

interface DefaultPrefillArgs {
  href?: string;
  context?: string;
  brandName?: string;
}

const normalizePhone = (phoneE164: string) => phoneE164.replace(/[^\d]/g, "");

export const buildWaLink = ({ phoneE164, text }: BuildWaLinkArgs) => {
  const normalizedPhone = normalizePhone(phoneE164);
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${normalizedPhone}${encodedText ? `?text=${encodedText}` : ""}`;
};

// eslint-disable-next-line atlas-brand/no-atlas-string-leak -- default fallback for brand name when not provided
export const defaultPrefill = ({ href, context, brandName = 'Atlas Homestays' }: DefaultPrefillArgs) => {
  const pageUrl = href || (typeof window !== "undefined" ? window.location.href : "");
  const contextText = context ? ` and I have a question about: ${context}` : "";
  return `Hi ${brandName} 👋 I'm reading the FAQ${contextText}. Page: ${pageUrl}`.trim();
};
