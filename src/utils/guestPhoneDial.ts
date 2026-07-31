/** TASK-1654 / TASK-1881 / TASK-5370: dial codes + validation for guest checkout (compact country selector).
 * TASK-5370: Updated for international E.164 support with libphonenumber-js validation.
 */

import { isValidPhoneNumber, type CountryCode } from "libphonenumber-js";

export type GuestDialOption = {
  /** E.164 prefix including + */
  code: string;
  label: string;
  /** Max national digits (excluding country code) */
  maxDigits: number;
  placeholder: string;
  hint: string;
  validate: (nationalDigits: string) => boolean;
  invalidMessage: string;
  /** TASK-5370: ISO country code for libphonenumber validation */
  countryCode: CountryCode;
};

const genericLocalInvalid = "Enter 7–12 digits (spaces and dashes are ignored)";

const indiaOption: GuestDialOption = {
  code: "+91",
  label: "🇮🇳 +91",
  maxDigits: 10,
  placeholder: "9876543210",
  hint: "10-digit mobile (starts with 6–9)",
  countryCode: "IN",
  validate: (d) => {
    // TASK-5370: Use libphonenumber validation
    if (!/^\d{10}$/.test(d)) return false;
    return isValidPhoneNumber("+91" + d, "IN");
  },
  invalidMessage: "Enter a valid 10-digit Indian mobile number",
};

const createGenericOption = (
  code: string,
  flag: string,
  maxDigits: number,
  placeholder: string,
  hint: string,
  countryCode: CountryCode
): GuestDialOption => ({
  code,
  label: `${flag} ${code}`,
  maxDigits,
  placeholder,
  hint,
  countryCode,
  validate: (d) => {
    // TASK-5370: Validate using libphonenumber
    if (!/^\d{7,12}$/.test(d)) return false;
    return isValidPhoneNumber(code + d, countryCode);
  },
  invalidMessage: genericLocalInvalid,
});

export const GUEST_DIAL_OPTIONS: GuestDialOption[] = [
  indiaOption,
  createGenericOption("+880", "🇧🇩", 12, "1712345678", "7–12 digits", "BD"),
  createGenericOption("+977", "🇳🇵", 12, "9812345678", "7–12 digits", "NP"),
  createGenericOption("+94", "🇱🇰", 12, "771234567", "7–12 digits", "LK"),
  createGenericOption("+92", "🇵🇰", 12, "3001234567", "7–12 digits", "PK"),
  createGenericOption("+975", "🇧🇹", 12, "17123456", "7–12 digits", "BT"),
  createGenericOption("+960", "🇲🇻", 12, "7912345", "7–12 digits", "MV"),
  createGenericOption("+86", "🇨🇳", 12, "13800138000", "7–12 digits", "CN"),
  createGenericOption("+65", "🇸🇬", 12, "81234567", "7–12 digits", "SG"),
  createGenericOption("+60", "🇲🇾", 12, "123456789", "7–12 digits", "MY"),
  createGenericOption("+66", "🇹🇭", 12, "812345678", "7–12 digits", "TH"),
  createGenericOption("+7", "🇷🇺", 12, "9161234567", "7–12 digits", "RU"),
  createGenericOption("+971", "🇦🇪", 12, "501234567", "7–12 digits", "AE"),
  createGenericOption("+44", "🇬🇧", 12, "7700900123", "7–12 digits", "GB"),
  createGenericOption("+1", "🇺🇸", 12, "4155552671", "7–12 digits", "US"),
];

export function getGuestDialOption(code: string): GuestDialOption {
  const found = GUEST_DIAL_OPTIONS.find((o) => o.code === code);
  return found ?? GUEST_DIAL_OPTIONS[0];
}

/** National digits only, capped to option length */
export function clampNationalDigits(raw: string, maxDigits: number): string {
  return raw.replace(/\D/g, "").slice(0, maxDigits);
}

/** Full number for API / guest record (E.164). */
export function toGuestPhoneE164(dialCode: string, nationalDigits: string): string {
  const dc = dialCode.startsWith("+") ? dialCode.slice(1) : dialCode.replace(/\D/g, "");
  return `+${dc}${nationalDigits}`;
}

/** Razorpay `contact` prefill: digits only, country code + national (no +). */
export function toRazorpayContactDigits(dialCode: string, nationalDigits: string): string {
  const opt = getGuestDialOption(dialCode);
  const cc = opt.code.replace(/\D/g, "");
  return `${cc}${nationalDigits}`;
}
