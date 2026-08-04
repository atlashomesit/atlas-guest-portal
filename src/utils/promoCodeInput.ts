/** TASK-6025: guest/admin/API must agree on allowed promo code shape. */
export const PROMO_CODE_MAX_LENGTH = 32;

/** Preserve hyphen, underscore, and space while typing — admin create does not strip these. */
export function normalizePromoCodeInput(raw: string): string {
  return raw.toUpperCase().slice(0, PROMO_CODE_MAX_LENGTH);
}

/** Trim + uppercase at validation/submit boundaries. */
export function normalizePromoCodeSubmit(raw: string): string {
  return raw.trim().toUpperCase();
}
