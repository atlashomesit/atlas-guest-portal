/**
 * The digits for a host `tel:+...` link, from the phone the host typed into their profile
 * (`TenantInfo.legalContactPack.contactPhone`; `TenantInfo` itself has no top-level `phone`).
 *
 * Hosts enter the number in several shapes ("98765 43210", "09876543210", "+91 98765 43210"), and a `tel:+` link only dials
 * when the country code is there, so a bare Indian national number gets "91". Anything that is not a plausible phone number
 * gives null, so the page shows no call link rather than a dead one.
 */
export function hostCallDigits(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  // Already carries a country code (E.164 allows up to 15 digits).
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}
