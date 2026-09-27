/**
 * TASK-102390 — Promo code entry is case-insensitive, whitespace-tolerant.
 */

export function normalizePromoCode(input: string): string {
  return input.trim().toUpperCase();
}

export function matchPromoCode(knownCodes: string[], input: string): string | null {
  const needle = normalizePromoCode(input);
  if (!needle) return null;
  const upper = knownCodes.map((c) => c.trim().toUpperCase());
  const idx = upper.indexOf(needle);
  return idx >= 0 ? knownCodes[idx] : null;
}

export interface PromoApplyResult {
  applied: boolean;
  code: string | null;
  badge: string | null;
}

export function applyPromoCode(knownCodes: string[], input: string, savingsLabel: string): PromoApplyResult {
  const code = matchPromoCode(knownCodes, input);
  if (!code) return { applied: false, code: null, badge: null };
  return { applied: true, code, badge: savingsLabel };
}
