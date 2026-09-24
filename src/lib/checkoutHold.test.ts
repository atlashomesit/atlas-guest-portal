import { describe, it, expect } from 'vitest';
import {
  CHECKOUT_HOLD_MINUTES, formatHoldCountdown, holdSecondsRemaining,
  isHoldExpired, restoreCheckoutSession,
} from './checkoutHold';

describe('TASK-102393 15-minute checkout hold floor', () => {
  it('holds inventory for the 15-minute industry standard', () => {
    expect(CHECKOUT_HOLD_MINUTES).toBe(15);
    expect(isHoldExpired(0, 14 * 60_000)).toBe(false);
    expect(isHoldExpired(0, 15 * 60_000)).toBe(true);
  });

  it('survives a 90-second bank OTP round-trip with countdown intact', () => {
    expect(holdSecondsRemaining(0, 90_000)).toBe(13 * 60 + 30);
    expect(formatHoldCountdown(810)).toBe('13:30');
  });

  it('restores dates + guest details instead of starting over', () => {
    const r = restoreCheckoutSession({
      checkInIso: '2026-11-01', checkOutIso: '2026-11-03',
      details: { name: 'Asha', email: 'a@x.com', phone: '+919876543210' },
    });
    expect(r.checkInIso).toBe('2026-11-01');
    expect(r.details.name).toBe('Asha');
  });
});
