import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentDowntimeBanner } from './PaymentDowntimeBanner';

describe('PAY-055 PaymentDowntimeBanner', () => {
  it('warns guest of active bank/UPI downtime and steers to working alternative', () => {
    const onSelect = vi.fn();
    render(
      <PaymentDowntimeBanner
        incidents={[
          {
            method: 'NETBANKING',
            issuerName: 'HDFC Bank',
            severity: 'down',
            recommendedAlternative: 'UPI QR',
          },
        ]}
        onSelectAlternative={onSelect}
      />
    );
    expect(screen.getByTestId('payment-downtime-banner')).toBeTruthy();
    expect(screen.getByText(/HDFC Bank/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Switch to UPI QR/i }));
    expect(onSelect).toHaveBeenCalledWith('UPI QR');
  });
});
