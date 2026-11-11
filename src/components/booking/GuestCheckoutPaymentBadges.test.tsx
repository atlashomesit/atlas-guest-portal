import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GuestCheckoutPaymentBadges } from './GuestCheckoutPaymentBadges';
import { PAYMENT_METHOD_BADGES } from './paymentMethodBadges';

describe('GuestCheckoutPaymentBadges (GUEST-032)', () => {
  it('renders container with data-testid="checkout-payment-rail-badges"', () => {
    render(<GuestCheckoutPaymentBadges />);
    const container = screen.getByTestId('checkout-payment-rail-badges');
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('gd-pay-rail');
  });

  it('applies custom className if provided', () => {
    render(<GuestCheckoutPaymentBadges className="custom-class" />);
    const container = screen.getByTestId('checkout-payment-rail-badges');
    expect(container).toHaveClass('gd-pay-rail');
    expect(container).toHaveClass('custom-class');
  });

  it('renders all required payment badges with readable accessible labels', () => {
    render(<GuestCheckoutPaymentBadges />);

    // UPI methods
    expect(screen.getByTestId('payment-badge-upi')).toHaveTextContent('UPI');
    expect(screen.getByTestId('payment-badge-gpay')).toHaveTextContent('Google Pay');
    expect(screen.getByTestId('payment-badge-phonepe')).toHaveTextContent('PhonePe');
    expect(screen.getByTestId('payment-badge-paytm')).toHaveTextContent('Paytm');
    expect(screen.getByTestId('payment-badge-bhim')).toHaveTextContent('BHIM');

    // Cards
    expect(screen.getByTestId('payment-badge-cards')).toHaveTextContent('Credit/Debit Cards');
    expect(screen.getByTestId('payment-badge-visa')).toHaveTextContent('Visa');
    expect(screen.getByTestId('payment-badge-mastercard')).toHaveTextContent('Mastercard');
    expect(screen.getByTestId('payment-badge-rupay')).toHaveTextContent('RuPay');

    // NetBanking
    expect(screen.getByTestId('payment-badge-netbanking')).toHaveTextContent('NetBanking');

    // Verify all badges in constant have accessible aria-labels
    for (const badge of PAYMENT_METHOD_BADGES) {
      const el = screen.getByLabelText(badge.label);
      expect(el).toBeInTheDocument();
      expect(el).toHaveAttribute('data-testid', `payment-badge-${badge.id}`);
    }
  });
});
