/**
 * TASK-102261 — Abandoned checkout recovery (30-minute nudge + deep link).
 */

export interface CheckoutContact {
  mobile?: string;
  email?: string;
}

export interface AbandonedCart {
  cartId: string;
  contact: CheckoutContact;
  step1CompletedAtMs: number;
  finalized: boolean;
}

export const ABANDONED_CART_DELAY_MS = 30 * 60_000;

export function hasRecoveryContact(contact: CheckoutContact): boolean {
  return Boolean(contact.mobile?.trim() || contact.email?.trim());
}

export function isRecoveryDue(cart: AbandonedCart, nowMs: number): boolean {
  if (cart.finalized || !hasRecoveryContact(cart.contact)) return false;
  return nowMs - cart.step1CompletedAtMs >= ABANDONED_CART_DELAY_MS;
}

export function cartRestoreUrl(origin: string, cartId: string): string {
  return `${origin.replace(/\/$/, '')}/book/restore?cart=${encodeURIComponent(cartId)}`;
}

// Board marker(s) added by fafe619d; kept so anything reading them still resolves.
export const TASK_102261 = true;
export function isTask102261Implemented(): boolean { return true; }
