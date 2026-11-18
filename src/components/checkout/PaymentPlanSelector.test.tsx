import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PaymentPlanSelector from './PaymentPlanSelector';

describe('PaymentPlanSelector (GUEST-076 / GUEST-077)', () => {
  const formatPrice = (v: number) => `₹${v.toLocaleString('en-IN')}`;

  it('renders nothing when neither RNPL nor monthly is eligible', () => {
    const { container } = render(
      <PaymentPlanSelector
        paymentPlans={{
          rnplEligible: false,
          reserveDepositPercent: 25,
          depositAmountNow: 0,
          remainingBalanceAmount: 0,
          allowZeroDepositReserve: false,
          monthlyEligible: false,
          monthlyInstalments: [],
        }}
        selectedPlan="Full"
        onChange={vi.fn()}
        displayTotal={10000}
        formatPrice={formatPrice}
      />,
    );
    expect(container.querySelector('[data-testid="payment-plan-selector"]')).toBeNull();
  });

  it('renders RNPL DepositNow, ZeroDeposit, and Monthly instalment previews', () => {
    const onChange = vi.fn();
    render(
      <PaymentPlanSelector
        paymentPlans={{
          rnplEligible: true,
          reserveDepositPercent: 25,
          depositAmountNow: 2500,
          remainingBalanceAmount: 7500,
          balanceDueAtUtc: '2026-12-01T12:00:00Z',
          allowZeroDepositReserve: true,
          monthlyEligible: true,
          monthlyInstalments: [
            { monthNumber: 1, periodStart: '2026-12-05', periodEnd: '2027-01-04', payableFromDate: '2026-12-05', dueDate: '2026-12-05', amount: 30000 },
            { monthNumber: 2, periodStart: '2027-01-04', periodEnd: '2027-01-19', payableFromDate: '2026-12-25', dueDate: '2027-01-01', amount: 15000 },
          ],
        }}
        selectedPlan="Monthly"
        onChange={onChange}
        displayTotal={45000}
        formatPrice={formatPrice}
      />,
    );

    expect(screen.getByTestId('payment-plan-option-Full')).toBeTruthy();
    expect(screen.getByTestId('payment-plan-option-DepositNow')).toBeTruthy();
    expect(screen.getByTestId('payment-plan-option-ZeroDeposit')).toBeTruthy();
    expect(screen.getByTestId('payment-plan-option-Monthly')).toBeTruthy();
    expect(screen.getByTestId('monthly-instalments-preview').textContent).toContain('Month 2');

    fireEvent.click(screen.getByTestId('payment-plan-option-ZeroDeposit'));
    expect(onChange).toHaveBeenCalledWith('ZeroDeposit');
  });
});
