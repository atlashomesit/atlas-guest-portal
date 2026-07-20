import { describe, expect, it } from 'vitest';
import {
  computeCancellationDeadline,
  computeEffectiveCancellationDeadline,
  formatCancellationDeadline,
  FREE_CANCELLATION_WINDOW_HOURS,
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
