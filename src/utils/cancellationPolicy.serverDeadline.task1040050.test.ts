import { describe, expect, it } from 'vitest';
import { describeCancellationPolicy, parseServerDeadline, resolveFreeCancellationTrustCopy } from './cancellationPolicy';

// TASK-1040050: one refund cutoff for the selected rate plan on every pre-pay screen. The server quotes it (rate-plans/public refundFreeUntilUtc, the resolver the hold
// uses at Pay); the browser's own tier arithmetic is only the fallback.

describe('server-quoted free-cancellation deadline', () => {
  const checkIn = new Date('2026-12-10T00:00:00+05:30');
  const now = new Date('2026-11-20T10:00:00+05:30');

  it('the server date IS the deadline the copy shows, whatever the tier arithmetic would say', () => {
    // Flexible would compute 8 Dec; the server says 3 Dec (an untiered 7-day window): the screen must say 3 Dec.
    const server = '2026-12-02T18:30:00Z'; // 12:00 AM, 3 Dec IST
    const copy = resolveFreeCancellationTrustCopy({ checkInDate: checkIn, tier: 'Flexible', serverDeadlineUtc: server, now });
    expect(copy.deadlineFormatted).toBe('12:00 AM, 3 Dec');
    expect(copy.trustMessage).toBe('Free cancellation until 12:00 AM, 3 Dec');
  });

  it('the booking box and the checkout read the same copy from the same server date', () => {
    const server = new Date('2026-12-02T18:30:00Z');
    const box = resolveFreeCancellationTrustCopy({ checkInDate: checkIn, tier: 'Strict', serverDeadlineUtc: server, now });
    const checkout = resolveFreeCancellationTrustCopy({ checkInDate: checkIn, tier: null, serverDeadlineUtc: server.toISOString(), now });
    expect(checkout.deadlineFormatted).toBe(box.deadlineFormatted);
  });

  it('an unreadable or missing server date falls back to the tier arithmetic, never to garbage', () => {
    expect(parseServerDeadline('not a date')).toBeNull();
    expect(parseServerDeadline(null)).toBeNull();
    expect(parseServerDeadline(undefined)).toBeNull();
    const copy = resolveFreeCancellationTrustCopy({ checkInDate: checkIn, tier: 'Strict', serverDeadlineUtc: 'garbage', now });
    expect(copy.deadlineFormatted).toBe('12:00 AM, 3 Dec'); // Strict 7 days before 10 Dec
  });

  it('a server deadline that has passed is not advertised as a benefit', () => {
    const copy = resolveFreeCancellationTrustCopy({ checkInDate: checkIn, tier: 'Strict', serverDeadlineUtc: '2026-11-01T00:00:00Z', now });
    expect(copy.deadlineFormatted).toBeNull();
    expect(copy.trustMessage).not.toMatch(/free cancellation/i);
  });

  it('the listing block, the rate card and the booking box lead with the same window for every tier', () => {
    // The API writes the rate card line with the same words ("Free cancellation up to 7 days before check-in").
    expect(describeCancellationPolicy('Strict').headline).toBe('Free cancellation up to 7 days before check-in');
    expect(describeCancellationPolicy(null).headline).toBe('Free cancellation up to 7 days before check-in');
    expect(describeCancellationPolicy('Moderate').headline).toBe('Free cancellation up to 5 days before check-in');
    expect(describeCancellationPolicy('Flexible').headline).toBe('Free cancellation up to 48 hours before check-in');
  });
});
