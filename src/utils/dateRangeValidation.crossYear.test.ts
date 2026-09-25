import { describe, it, expect } from 'vitest';
import { isCheckoutAfterCheckin, validateStayRange } from './dateRangeValidation';

/**
 * TASK-102389 — date picker must allow checkout dates across calendar years.
 * Board case: guest books Dec 28 → Jan 3; a `getMonth()`-only comparison (11 >= 0)
 * rejects it. Full UTC timestamp comparison accepts it.
 */
describe('dateRangeValidation — TASK-102389 cross-year stays', () => {
  it('accepts Dec 28 → Jan 3 across New Year', () => {
    const checkIn = new Date(2026, 11, 28); // Dec 28 2026 (local midnight)
    const checkOut = new Date(2027, 0, 3); // Jan 3 2027
    expect(isCheckoutAfterCheckin(checkIn, checkOut)).toBe(true);
    expect(validateStayRange(checkIn, checkOut)).toEqual({ valid: true, error: null });
  });

  it('rejects a checkout on or before check-in, including same-date', () => {
    const checkIn = new Date(2026, 11, 28);
    expect(isCheckoutAfterCheckin(checkIn, new Date(2026, 11, 28))).toBe(false);
    expect(isCheckoutAfterCheckin(checkIn, new Date(2026, 11, 27))).toBe(false);
    expect(validateStayRange(checkIn, new Date(2026, 11, 27)).valid).toBe(false);
  });

  it('compares full timestamps, not month components (Dec month 11 vs Jan month 0)', () => {
    // A month-only comparison `checkOut.getMonth() >= checkIn.getMonth()` yields 0 >= 11 = false.
    const checkIn = new Date(Date.UTC(2026, 11, 28));
    const checkOut = new Date(Date.UTC(2027, 0, 3));
    expect(checkOut.getMonth() >= checkIn.getMonth()).toBe(false); // the old defect shape
    expect(isCheckoutAfterCheckin(checkIn, checkOut)).toBe(true); // the required semantics
  });

  it('returns false when either date is missing', () => {
    expect(isCheckoutAfterCheckin(null, new Date())).toBe(false);
    expect(isCheckoutAfterCheckin(new Date(), null)).toBe(false);
  });
});
