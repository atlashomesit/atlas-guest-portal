import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CancellationMilestoneTimeline from './CancellationMilestoneTimeline';

describe('CancellationMilestoneTimeline (TASK-1040204)', () => {
  it('renders Non-Refundable policy card without Flexible label or Full refund cutoff when cancellationTier is NonRefundable', () => {
    render(
      <CancellationMilestoneTimeline
        checkInDate="2027-02-05"
        cancellationTier="NonRefundable"
      />,
    );

    const card = screen.getByTestId('cancellation-milestone-timeline');
    expect(card.textContent).toContain('Non-Refundable');
    expect(card.textContent).not.toContain('Flexible');
    expect(card.textContent).not.toContain('Full refund cutoff');
    expect(screen.queryByTestId('cancellation-full-refund-cutoff')).toBeNull();
    expect(screen.getByTestId('cancellation-non-refundable-notice')).toBeTruthy();
  });

  it('handles case-insensitive non-refundable variants', () => {
    render(
      <CancellationMilestoneTimeline
        checkInDate="2027-02-05"
        cancellationTier="non-refundable"
      />,
    );

    expect(screen.getByTestId('cancellation-non-refundable-notice')).toBeTruthy();
    expect(screen.queryByTestId('cancellation-full-refund-cutoff')).toBeNull();
  });
});
