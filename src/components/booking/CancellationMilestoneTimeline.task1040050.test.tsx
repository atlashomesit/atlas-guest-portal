/**
 * TASK-1040050: on the checkout page the timeline said "Full refund cutoff: 12:00 AM, 8 Dec" (Flexible, 48 h) while the
 * line beside it said "Free cancellation until 12:00 AM, 3 Dec" for the same stay. The timeline now computes the cutoff
 * from the same inputs and the same rule as that line (resolveFreeCancellationTrustCopy), which is the deadline the API
 * stamps on the booking (RefundDeadlineResolver: no named tier = the platform 7-day window).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import CancellationMilestoneTimeline from './CancellationMilestoneTimeline';
import { resolveFreeCancellationTrustCopy } from '@/utils/cancellationPolicy';

afterEach(() => cleanup());

const NOW = new Date('2026-11-06T18:30:00Z');
const CHECK_IN = '2026-12-10';

function cutoffText(): string {
  return screen.getByTestId('cancellation-full-refund-cutoff').textContent ?? '';
}

describe('CancellationMilestoneTimeline - TASK-1040050: one refund cutoff per stay', () => {
  it.each([
    ['no tier (fresh listing, Default plan with no rule)', null],
    ['an unrecognised plan policy', 'Custom'],
    ['Strict', 'Strict'],
    ['Moderate', 'Moderate'],
    ['Flexible', 'Flexible'],
  ])('%s: the cutoff equals the "Free cancellation until" deadline on the same page', (_label, tier) => {
    const trust = resolveFreeCancellationTrustCopy({
      checkInDate: new Date(CHECK_IN),
      tier,
      bookingCreatedAt: NOW,
      now: NOW,
    });
    expect(trust.deadlineFormatted).toBeTruthy();

    render(<CancellationMilestoneTimeline checkInDate={CHECK_IN} cancellationTier={tier} bookingCreatedAt={NOW} />);

    expect(cutoffText()).toContain(trust.deadlineFormatted!);
  });

  it('no tier: the cutoff is 3 Dec (the 7-day platform window), never the 48-hour 8 Dec', () => {
    render(<CancellationMilestoneTimeline checkInDate={CHECK_IN} cancellationTier={null} bookingCreatedAt={NOW} />);

    expect(cutoffText()).toContain('3 Dec');
    expect(cutoffText()).not.toContain('8 Dec');
  });
});
