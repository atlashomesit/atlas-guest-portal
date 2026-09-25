/**
 * TASK-102393 — 15-minute checkout hold with visible countdown + detail restore.
 */

export const CHECKOUT_HOLD_MINUTES = 15;
export const CHECKOUT_HOLD_MS = CHECKOUT_HOLD_MINUTES * 60_000;

export interface GuestDetails {
  name: string;
  email: string;
  phone: string;
}

export function holdExpiresAtMs(holdStartedAtMs: number): number {
  return holdStartedAtMs + CHECKOUT_HOLD_MS;
}

export function holdSecondsRemaining(holdStartedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((holdExpiresAtMs(holdStartedAtMs) - nowMs) / 1000));
}

export function isHoldExpired(holdStartedAtMs: number, nowMs: number): boolean {
  return nowMs >= holdExpiresAtMs(holdStartedAtMs);
}

export function formatHoldCountdown(secondsRemaining: number): string {
  const s = Math.max(0, Math.floor(secondsRemaining));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function restoreCheckoutSession(stored: { checkInIso: string; checkOutIso: string; details: GuestDetails }): {
  checkInIso: string;
  checkOutIso: string;
  details: GuestDetails;
} {
  return { checkInIso: stored.checkInIso, checkOutIso: stored.checkOutIso, details: { ...stored.details } };
}
