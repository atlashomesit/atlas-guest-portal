/** TASK-1881: dial codes + national-digit validation for guest checkout (white-label / intl). */

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

export const GUEST_DIAL_OPTIONS: GuestDialOption[] = [
  {
    code: '+91',
    label: 'IN +91',
    maxDigits: 10,
    placeholder: '9876543210',
    hint: '10-digit mobile (starts with 6–9)',
    validate: (d) => /^[6-9]\d{9}$/.test(d),
    invalidMessage: 'Enter a valid 10-digit Indian mobile number',
  },
  {
    code: '+1',
    label: 'US +1',
    maxDigits: 10,
    placeholder: '4155552671',
    hint: '10-digit US number',
    validate: (d) => /^\d{10}$/.test(d),
    invalidMessage: 'Enter a valid 10-digit US phone number',
  },
  {
    code: '+44',
    label: 'UK +44',
    maxDigits: 10,
    placeholder: '7700900123',
    hint: 'UK mobile without leading 0 (10 digits)',
    validate: (d) => /^\d{10}$/.test(d),
    invalidMessage: 'Enter a valid UK mobile (10 digits, no leading 0)',
  },
  {
    code: '+971',
    label: 'AE +971',
    maxDigits: 9,
    placeholder: '501234567',
    hint: '9-digit UAE mobile',
    validate: (d) => /^\d{9}$/.test(d),
    invalidMessage: 'Enter a valid 9-digit UAE mobile number',
  },
  {
    code: '+65',
    label: 'SG +65',
    maxDigits: 8,
    placeholder: '81234567',
    hint: '8-digit Singapore number',
    validate: (d) => /^\d{8}$/.test(d),
    invalidMessage: 'Enter a valid 8-digit Singapore phone number',
  },
];

export function getGuestDialOption(code: string): GuestDialOption {
  const found = GUEST_DIAL_OPTIONS.find((o) => o.code === code);
  return found ?? GUEST_DIAL_OPTIONS[0];
}

/** National digits only, capped to option length */
export function clampNationalDigits(raw: string, maxDigits: number): string {
  return raw.replace(/\D/g, '').slice(0, maxDigits);
}

/** Full number for API / guest record (E.164). */
export function toGuestPhoneE164(dialCode: string, nationalDigits: string): string {
  const opt = getGuestDialOption(dialCode);
  const dc = dialCode.startsWith('+') ? dialCode.slice(1) : dialCode.replace(/\D/g, '');
  return `+${dc}${nationalDigits}`;
}

/** Razorpay `contact` prefill: digits only, country code + national (no +). */
export function toRazorpayContactDigits(dialCode: string, nationalDigits: string): string {
  const opt = getGuestDialOption(dialCode);
  const cc = opt.code.replace(/\D/g, '');
  return `${cc}${nationalDigits}`;
}
