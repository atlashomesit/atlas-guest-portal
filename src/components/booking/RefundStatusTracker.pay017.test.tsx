/**
 * @vitest-environment jsdom
 * PAY-017: a refund the host recorded by hand (UPI / bank transfer / cash) shows the UTR the host typed as the host's reference, never as a bank confirmation.
 */
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import RefundStatusTracker from './RefundStatusTracker';

afterEach(() => cleanup());

describe('RefundStatusTracker (PAY-017)', () => {
  it('shows the UTR the host typed for a refund the host recorded by hand, and no bank-processed claim', () => {
    render(
      <RefundStatusTracker
        refunds={[{ amount: 1500, status: 'recorded_by_host', initiatedAtUtc: '2026-10-29T08:00:00Z', processedAtUtc: null, bankReference: 'UTR4123456789' }]}
      />,
    );
    expect(screen.getByTestId('refund-host-reference')).toHaveTextContent('UTR4123456789');
    expect(screen.queryByTestId('refund-processed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('refund-bank-reference')).not.toBeInTheDocument();
  });

  it('shows no reference row when the host recorded none (cash)', () => {
    render(<RefundStatusTracker refunds={[{ amount: 500, status: 'recorded_by_host', initiatedAtUtc: '2026-10-29T08:00:00Z', bankReference: null }]} />);
    expect(screen.queryByTestId('refund-host-reference')).not.toBeInTheDocument();
  });
});
