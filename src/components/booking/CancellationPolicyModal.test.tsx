import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CancellationPolicyModal from './CancellationPolicyModal';
import { getCancellationRefundTiers } from '@/utils/cancellationPolicy';

describe('CancellationPolicyModal (TASK-10298996: Unambiguous refund tiers wording)', () => {
  it('computes unambiguous refund tiers for Flexible tier matching backend definition', () => {
    const tiers = getCancellationRefundTiers('Flexible');
    expect(tiers).toHaveLength(2);
    expect(tiers[0].cutoffLabel).toContain('48 hours');
    expect(tiers[0].refundLabel).toBe('100% refund');
    expect(tiers[0].description).toContain('Free cancellation up to 48 hours before check-in');
    expect(tiers[1].cutoffLabel).toContain('Within 48 hours');
    expect(tiers[1].refundLabel).toBe('Non-refundable');
    expect(tiers[1].description).toContain('Non-refundable within 48h');
  });

  it('computes unambiguous refund tiers for Moderate and Strict tiers', () => {
    const modTiers = getCancellationRefundTiers('Moderate');
    expect(modTiers.some((t) => t.refundLabel === '100% refund')).toBe(true);
    expect(modTiers.some((t) => t.refundLabel === '50% partial refund')).toBe(true);

    const strictTiers = getCancellationRefundTiers('Strict');
    expect(strictTiers[0].description).toContain('7 days');
    expect(strictTiers[1].refundLabel).toBe('Non-refundable');
  });

  it('renders modal with unambiguous refund tiers and policy badge', () => {
    const onClose = vi.fn();
    render(
      <CancellationPolicyModal
        isOpen={true}
        onClose={onClose}
        cancellationTier="Flexible"
      />
    );

    expect(screen.getByTestId('cancellation-policy-modal')).toBeInTheDocument();
    expect(screen.getByTestId('cancellation-policy-tier-badge')).toHaveTextContent('Flexible');

    const refundTiersContainer = screen.getByTestId('cancellation-refund-tiers');
    expect(refundTiersContainer).toHaveTextContent(/Free cancellation up to 48 hours before check-in/);
    expect(refundTiersContainer).toHaveTextContent(/Non-refundable within 48h/);

    fireEvent.click(screen.getByTestId('cancellation-modal-close-btn'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CancellationPolicyModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});
