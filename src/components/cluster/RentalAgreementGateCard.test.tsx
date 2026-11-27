import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RentalAgreementGateCard } from './RentalAgreementGateCard';

describe('CLU-051 RentalAgreementGateCard', () => {
  it('gates check-in instructions until the guest signs the villa rental agreement', async () => {
    const onSign = vi.fn();
    render(
      <RentalAgreementGateCard
        villaName="Alibaug Sea Breeze Villa"
        clauses={['Quiet hours after 10 PM', 'No unregistered overnight guests']}
        onSign={onSign}
      >
        <div data-testid="door-pin">Door PIN: 4829</div>
      </RentalAgreementGateCard>
    );

    expect(screen.queryByTestId('door-pin')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText(/Full legal name/i), {
      target: { value: 'Aarav Sharma' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign & Unlock/i }));

    await waitFor(() => {
      expect(screen.getByTestId('door-pin')).toBeTruthy();
    });
    expect(onSign).toHaveBeenCalledTimes(1);
    expect(onSign.mock.calls[0][0].signedBy).toBe('Aarav Sharma');
  });
});
