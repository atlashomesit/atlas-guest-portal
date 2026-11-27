/**
 * GUEST-084: Indian 15-character GSTIN normalization & format validation.
 * Format: 2-digit state code + 10-char PAN (5 letters, 4 digits, 1 letter) + entity number (1-9A-Z) + 'Z' + checksum (0-9A-Z).
 */

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function normalizeGstin(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase().slice(0, 15);
}

export function isValidGstin(raw: string): boolean {
  const normalized = normalizeGstin(raw);
  if (!GSTIN_REGEX.test(normalized)) return false;
  const stateCode = Number(normalized.slice(0, 2));
  return (stateCode >= 1 && stateCode <= 38) || stateCode === 97 || stateCode === 99;
}

export function validateCompanyGstInput(args: {
  companyName: string;
  guestGstin: string;
}): { companyNameError?: string; gstinError?: string } {
  const errors: { companyNameError?: string; gstinError?: string } = {};
  const trimmedName = args.companyName.trim();
  const normalizedGstin = normalizeGstin(args.guestGstin);

  if (!trimmedName) {
    errors.companyNameError = 'Enter your company or legal business name.';
  } else if (trimmedName.length < 2) {
    errors.companyNameError = 'Company name must be at least 2 characters.';
  }

  if (!normalizedGstin) {
    errors.gstinError = 'Enter a 15-character GSTIN.';
  } else if (!isValidGstin(normalizedGstin)) {
    errors.gstinError = 'Enter a valid 15-character Indian GSTIN (e.g. 29ABCDE1234F1Z5).';
  }

  return errors;
}
