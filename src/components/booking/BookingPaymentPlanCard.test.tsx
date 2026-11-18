import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingPaymentPlanCard from './BookingPaymentPlanCard';

describe('BookingPaymentPlanCard (GUEST-076 / GUEST-077)', () => {
  it('renders RNPL balance due and Pay remaining balance link', () => {
    render(
      <MemoryRouter>
        <BookingPaymentPlanCard
          paymentPlan="DepositNow"
          depositPercent={25}
          amountReceived={2500}
          balanceDue={7500}
          balanceDueAtUtc="2026-12-10T10:00:00Z"
          payLinkToken="tok_rnpl_1"
          isCancelled={false}
        />
      </MemoryRouter>,
    );
    const btn = screen.getByTestId('rnpl-pay-balance-btn') as HTMLAnchorElement;
    expect(btn.getAttribute('href')).toBe('/pay/tok_rnpl_1');
  });

  it('renders Monthly instalments with Pay by UPI link carrying instalmentId', () => {
    render(
      <MemoryRouter>
        <BookingPaymentPlanCard
          paymentPlan="Monthly"
          payLinkToken="tok_base"
          isCancelled={false}
          instalments={[
            {
              id: 11,
              monthNumber: 1,
              periodStart: '2026-11-01',
              periodEnd: '2026-12-01',
              amount: 30000,
              payableFromDate: '2026-11-01',
              dueDate: '2026-11-01',
              status: 'Paid',
            },
            {
              id: 12,
              monthNumber: 2,
              periodStart: '2026-12-01',
              periodEnd: '2026-12-31',
              amount: 30000,
              payableFromDate: '2026-11-21',
              dueDate: '2026-11-28',
              status: 'Due',
              payLinkToken: 'tok_inst_12',
            },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('guest-instalment-pay-1')).toBeNull();
    const pay2 = screen.getByTestId('guest-instalment-pay-2') as HTMLAnchorElement;
    expect(pay2.getAttribute('href')).toBe('/pay/tok_inst_12?instalmentId=12');
  });
});
