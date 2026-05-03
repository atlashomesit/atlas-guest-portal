/** TASK-1654 / TASK-1881: dial codes + validation for guest checkout (compact country selector). */

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
};

const genericLocalInvalid = "Enter 7–12 digits (spaces and dashes are ignored)";

const indiaOption: GuestDialOption = {
  code: "+91",
  label: "🇮🇳 +91",
  maxDigits: 10,
  placeholder: "9876543210",
  hint: "10-digit mobile (starts with 6–9)",
  validate: (d) => /^[6-9]\d{9}$/.test(d),
  invalidMessage: "Enter a valid 10-digit Indian mobile number",
};

const genericOption = (code: string, flag: string, maxDigits: number, placeholder: string, hint: string): GuestDialOption => ({
  code,
  label: `${flag} ${code}`,
  maxDigits,
  placeholder,
  hint,
  validate: (d) => /^\d{7,12}$/.test(d),
  invalidMessage: genericLocalInvalid,
});

export const GUEST_DIAL_OPTIONS: GuestDialOption[] = [
  indiaOption,
  genericOption("+880", "🇧🇩", 12, "1712345678", "7–12 digits"),
  genericOption("+977", "🇳🇵", 12, "9812345678", "7–12 digits"),
  genericOption("+94", "🇱🇰", 12, "771234567", "7–12 digits"),
  genericOption("+92", "🇵🇰", 12, "3001234567", "7–12 digits"),
  genericOption("+975", "🇧🇹", 12, "17123456", "7–12 digits"),
  genericOption("+960", "🇲🇻", 12, "7912345", "7–12 digits"),
  genericOption("+86", "🇨🇳", 12, "13800138000", "7–12 digits"),
  genericOption("+65", "🇸🇬", 12, "81234567", "7–12 digits"),
  genericOption("+60", "🇲🇾", 12, "123456789", "7–12 digits"),
  genericOption("+66", "🇹🇭", 12, "812345678", "7–12 digits"),
  genericOption("+971", "🇦🇪", 12, "501234567", "7–12 digits"),
  genericOption("+44", "🇬🇧", 12, "7700900123", "7–12 digits"),
  genericOption("+1", "🇺🇸", 12, "4155552671", "7–12 digits"),
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
