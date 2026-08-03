import { describe, expect, it } from 'vitest';
import {
  computeCancellationDeadline,
  computeEffectiveCancellationDeadline,
  formatCancellationDeadline,
  FREE_CANCELLATION_WINDOW_HOURS,
  resolveApplicableGraceHours,
  resolveFreeCancellationTrustCopy,
} from './cancellationPolicy';

// TASK-4334: guest-facing cancellation deadline computation/formatting.
describe('computeCancellationDeadline', () => {
  it('subtracts 48 hours (IST) for the Flexible tier', () => {
    // Check-in 12 Jul 2026, IST midnight → deadline = 10 Jul, 12:00 AM IST + ... i.e. 48h earlier.
    const checkIn = new Date('2026-07-12T00:00:00+05:30');
    const deadline = computeCancellationDeadline(checkIn, 'Flexible');
    expect(deadline.toISOString()).toBe(new Date('2026-07-10T00:00:00+05:30').toISOString());
  });

  it('subtracts 5 days for the Moderate tier', () => {
    const checkIn = new Date('2026-07-12T00:00:00+05:30');
    const deadline = computeCancellationDeadline(checkIn, 'Moderate');
    expect(deadline.toISOString()).toBe(new Date('2026-07-07T00:00:00+05:30').toISOString());
  });

  it('subtracts 7 days for the Strict tier', () => {
    const checkIn = new Date('2026-07-12T00:00:00+05:30');
    const deadline = computeCancellationDeadline(checkIn, 'Strict');
    expect(deadline.toISOString()).toBe(new Date('2026-07-05T00:00:00+05:30').toISOString());
  });

  it('defaults to 168h (7 days) when tier is null/undefined/unrecognized (TASK-4356 founder default)', () => {
    const checkIn = new Date('2026-07-12T00:00:00+05:30');
    const expected = new Date('2026-07-05T00:00:00+05:30').toISOString();
    expect(computeCancellationDeadline(checkIn, null).toISOString()).toBe(expected);
    expect(computeCancellationDeadline(checkIn, undefined).toISOString()).toBe(expected);
    expect(computeCancellationDeadline(checkIn, 'NonRefundable').toISOString()).toBe(expected);
  });

  it('prefers the server-sourced windowHoursOverride over the local tier map', () => {
    const checkIn = new Date('2026-07-12T00:00:00+05:30');
    // Server says 72h even though the local map would say Flexible=48h — override wins.
    const deadline = computeCancellationDeadline(checkIn, 'Flexible', 72);
    expect(deadline.toISOString()).toBe(new Date('2026-07-09T00:00:00+05:30').toISOString());
  });

  it('ignores a non-positive windowHoursOverride and falls back to the tier map', () => {
    const checkIn = new Date('2026-07-12T00:00:00+05:30');
    const deadline = computeCancellationDeadline(checkIn, 'Moderate', 0);
    expect(deadline.toISOString()).toBe(new Date('2026-07-07T00:00:00+05:30').toISOString());
  });

  it('recomputes a different deadline when the check-in date changes', () => {
    const checkInA = new Date('2026-07-12T00:00:00+05:30');
    const checkInB = new Date('2026-08-01T00:00:00+05:30');
    const deadlineA = computeCancellationDeadline(checkInA, 'Flexible');
    const deadlineB = computeCancellationDeadline(checkInB, 'Flexible');
    expect(deadlineA.getTime()).not.toBe(deadlineB.getTime());
  });

  it('handles a check-in date passed with a non-midnight time-of-day by flooring to IST midnight first', () => {
    // Selected date pickers typically hand us a Date at local midnight already, but guard
    // against a stray time-of-day component (e.g. from `new Date()` with current time).
    const checkInWithTime = new Date('2026-07-12T15:47:00+05:30');
    const deadline = computeCancellationDeadline(checkInWithTime, 'Flexible');
    expect(deadline.toISOString()).toBe(new Date('2026-07-10T00:00:00+05:30').toISOString());
  });

  it('crosses a month/year boundary correctly (Strict tier, early January check-in)', () => {
    const checkIn = new Date('2027-01-03T00:00:00+05:30');
    const deadline = computeCancellationDeadline(checkIn, 'Strict');
    expect(deadline.toISOString()).toBe(new Date('2026-12-27T00:00:00+05:30').toISOString());
  });

  it('every tier maps to a positive, non-zero window (sanity guard against drift)', () => {
    for (const hours of Object.values(FREE_CANCELLATION_WINDOW_HOURS)) {
      expect(hours).toBeGreaterThan(0);
    }
  });
});

describe('formatCancellationDeadline', () => {
  it('formats as "h:mm a, d LLL" in IST', () => {
    const deadline = new Date('2026-07-10T00:00:00+05:30');
    expect(formatCancellationDeadline(deadline)).toBe('12:00 AM, 10 Jul');
  });

  it('formats a UTC instant correctly by converting to IST first', () => {
    // 18:30 UTC == 00:00 IST next day
    const deadline = new Date('2026-07-09T18:30:00Z');
    expect(formatCancellationDeadline(deadline)).toBe('12:00 AM, 10 Jul');
  });
});

describe('computeEffectiveCancellationDeadline', () => {
  const checkIn = new Date('2026-07-12T00:00:00+05:30');
  const bookingCreatedAt = new Date('2026-06-01T12:00:00+05:30');

  it('defaults to 168h when tier is null (TASK-5179)', () => {
    const deadline = computeEffectiveCancellationDeadline(checkIn, null, null, bookingCreatedAt, null);
    expect(deadline.toISOString()).toBe(new Date('2026-07-05T00:00:00+05:30').toISOString());
  });

  it('uses 48h for Flexible tier', () => {
    const deadline = computeEffectiveCancellationDeadline(checkIn, 'Flexible', null, bookingCreatedAt, null);
    expect(deadline.toISOString()).toBe(new Date('2026-07-10T00:00:00+05:30').toISOString());
  });

  it('uses 168h for Strict tier', () => {
    const deadline = computeEffectiveCancellationDeadline(checkIn, 'Strict', null, bookingCreatedAt, null);
    expect(deadline.toISOString()).toBe(new Date('2026-07-05T00:00:00+05:30').toISOString());
  });

  it('prefers server windowHoursOverride over tier map', () => {
    const deadline = computeEffectiveCancellationDeadline(checkIn, 'Flexible', 168, bookingCreatedAt, null);
    expect(deadline.toISOString()).toBe(new Date('2026-07-05T00:00:00+05:30').toISOString());
  });
});

describe('resolveFreeCancellationTrustCopy (TASK-7012)', () => {
  it('returns active free-cancellation copy when deadline is in the future', () => {
    const checkIn = new Date('2026-08-15T00:00:00+05:30');
    const now = new Date('2026-07-01T12:00:00+05:30');
    const copy = resolveFreeCancellationTrustCopy({
      checkInDate: checkIn,
      tier: 'Flexible',
      now,
    });
    expect(copy.trustMessage).toMatch(/^Free cancellation until /);
    expect(copy.deadlineFormatted).toBe('12:00 AM, 13 Aug');
  });

  it('does not advertise a past deadline as a benefit for near-term check-in', () => {
    const checkIn = new Date('2026-07-28T00:00:00+05:30');
    const now = new Date('2026-07-28T10:00:00+05:30');
    const copy = resolveFreeCancellationTrustCopy({
      checkInDate: checkIn,
      tier: 'Strict',
      now,
    });
    expect(copy.deadlineFormatted).toBeNull();
    expect(copy.trustMessage).toBe('Standard cancellation policy applies for this stay.');
  });

  /**
   * TASK-7012 regression: a VOIDED grace window is not a benefit. Booking within `graceHours` of
   * check-in voids the window server-side (`CancellationPolicyWindow`), so when the tier deadline has
   * also lapsed the guest has NO free cancellation — the copy must say so, and must not hand callers
   * a null message that leaves a "free cancellation for N hours after you book" strip as the only
   * cancellation text on the page.
   */
  it('states the standard policy (not silence) when the grace window is VOIDED and the tier deadline has lapsed', () => {
    const checkIn = new Date('2026-07-28T00:00:00+05:30');
    const now = new Date('2026-07-28T10:00:00+05:30'); // booked same-day → grace voided
    const copy = resolveFreeCancellationTrustCopy({
      checkInDate: checkIn,
      tier: 'Strict',
      graceHours: 24,
      bookingCreatedAt: now,
      now,
    });
    expect(copy.applicableGraceHours).toBeNull();
    expect(copy.deadlineFormatted).toBeNull();
    expect(copy.trustMessage).toBe('Standard cancellation policy applies for this stay.');
    // Whatever we say, it must never read as a free-cancellation promise.
    expect(copy.trustMessage).not.toMatch(/free cancellation/i);
  });

  it('extends the deadline into the grace window when grace is NOT voided (tier deadline already lapsed)', () => {
    const checkIn = new Date('2026-08-01T00:00:00+05:30');
    const now = new Date('2026-07-30T12:00:00+05:30');
    // Strict tier deadline = 25 Jul (lapsed); grace not voided (check-in is >24h out).
    const copy = resolveFreeCancellationTrustCopy({
      checkInDate: checkIn,
      tier: 'Strict',
      graceHours: 24,
      bookingCreatedAt: now,
      now,
    });
    expect(copy.applicableGraceHours).toBe(24);
    expect(copy.deadlineFormatted).toBe('12:00 PM, 31 Jul');
    expect(copy.trustMessage).toBe('Free cancellation until 12:00 PM, 31 Jul');
  });

  it('suppresses tier deadline copy only when a live grace window carries the claim', () => {
    // An existing booking re-rendered after its grace window elapsed but while grace still "applied"
    // (not voided at booking time): nothing truthful left to say here, so the caller's grace strip owns it.
    const copy = resolveFreeCancellationTrustCopy({
      checkInDate: new Date('2026-08-05T00:00:00+05:30'),
      tier: 'Strict',
      graceHours: 24,
      bookingCreatedAt: new Date('2026-07-30T12:00:00+05:30'),
      now: new Date('2026-08-01T12:00:00+05:30'),
    });
    expect(copy.trustMessage).toBeNull();
    expect(copy.deadlineFormatted).toBeNull();
    expect(copy.applicableGraceHours).toBe(24);
  });

  it('never advertises a deadline that has already passed', () => {
    const now = new Date('2026-07-28T10:00:00+05:30');
    for (const graceHours of [null, undefined, 0, 24, 48]) {
      const copy = resolveFreeCancellationTrustCopy({
        checkInDate: new Date('2026-07-28T00:00:00+05:30'),
        tier: 'Strict',
        graceHours,
        bookingCreatedAt: now,
        now,
      });
      expect(copy.deadlineFormatted, `graceHours=${graceHours}`).toBeNull();
      expect(copy.trustMessage ?? '', `graceHours=${graceHours}`).not.toMatch(/until/i);
    }
  });
});

/**
 * TASK-7012: mirrors `CancellationPolicyWindow.ComputeEffectiveFreeCancellationDeadlineUtc`'s void
 * carve-out. Drift here means the guest portal advertises a grace window the API refuses to honour.
 */
describe('resolveApplicableGraceHours', () => {
  const checkIn = new Date('2026-07-28T00:00:00+05:30');

  it('returns null when no grace window is configured (flag-off parity)', () => {
    const bookedAt = new Date('2026-07-01T12:00:00+05:30');
    expect(resolveApplicableGraceHours(checkIn, bookedAt, null)).toBeNull();
    expect(resolveApplicableGraceHours(checkIn, bookedAt, undefined)).toBeNull();
    expect(resolveApplicableGraceHours(checkIn, bookedAt, 0)).toBeNull();
    expect(resolveApplicableGraceHours(checkIn, bookedAt, -5)).toBeNull();
  });

  it('returns the grace hours when check-in is outside the window from booking time', () => {
    // Booked 27 Jul 00:00 IST, check-in 28 Jul 00:00 IST → exactly 24h out, not voided.
    expect(resolveApplicableGraceHours(checkIn, new Date('2026-07-27T00:00:00+05:30'), 24)).toBe(24);
    expect(resolveApplicableGraceHours(checkIn, new Date('2026-07-01T12:00:00+05:30'), 24)).toBe(24);
  });

  it('VOIDS the window when check-in falls inside it from booking time', () => {
    // One minute later than the boundary above → check-in is now inside the 24h window.
    expect(resolveApplicableGraceHours(checkIn, new Date('2026-07-27T00:01:00+05:30'), 24)).toBeNull();
    // Same-day booking is the canonical voided case.
    expect(resolveApplicableGraceHours(checkIn, new Date('2026-07-28T10:00:00+05:30'), 24)).toBeNull();
  });

  it('voids on a wider configured window that a 24h window would have allowed', () => {
    const bookedAt = new Date('2026-07-26T12:00:00+05:30');
    expect(resolveApplicableGraceHours(checkIn, bookedAt, 24)).toBe(24);
    // 48h window: check-in − 48h = 26 Jul 00:00 IST, which is before booking → voided.
    expect(resolveApplicableGraceHours(checkIn, bookedAt, 48)).toBeNull();
  });
});
