import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FeeInfoTip, FEE_INFO_COPY } from './FeeInfoTip';

// TASK-102113: fee line (?) tooltips — accessible hover + mobile tap popover.
describe('FeeInfoTip (TASK-102113)', () => {
  it('renders an info button named for the fee line', () => {
    render(<FeeInfoTip fee="cleaning" label="Cleaning fee" testId="fee-info-cleaning" />);
    expect(
      screen.getByRole('button', { name: 'More info about Cleaning fee' }),
    ).toBeInTheDocument();
  });

  it('shows the generic cleaning-fee explanation with no invented amounts', () => {
    render(<FeeInfoTip fee="cleaning" label="Cleaning fee" testId="fee-info-cleaning" />);
    const tip = screen.getByTestId('fee-info-cleaning-tooltip');
    expect(tip).toHaveTextContent(FEE_INFO_COPY.cleaning);
    // Copy rule: generic explanation only — no invented host policy amounts.
    expect(tip.textContent).not.toMatch(/₹|Rs\.?|\d+\s*%/);
  });

  it('tap toggles the popover open and closed (mobile popover sheet)', async () => {
    render(
      <FeeInfoTip fee="paymentProcessing" label="Payment processing" testId="fee-info-payment" />,
    );
    const button = screen.getByRole('button', { name: 'More info about Payment processing' });
    const tip = screen.getByTestId('fee-info-payment-tooltip');

    // Closed by default (hidden arm, no `block` class).
    expect(tip.className).not.toMatch(/(?:^|\s)block(?:\s|$)/);
    expect(button).toHaveAttribute('aria-expanded', 'false');

    // Tap opens a clean popover with the gateway copy.
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(tip).toHaveClass('block');
    expect(tip).toHaveTextContent(FEE_INFO_COPY.paymentProcessing);

    // Tap again closes it.
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(tip.className).not.toMatch(/(?:^|\s)block(?:\s|$)/);
  });

  it('Escape closes an open popover', () => {
    render(<FeeInfoTip fee="touristTax" label="Tourist tax" testId="fee-info-tourist" />);
    const button = screen.getByRole('button', { name: 'More info about Tourist tax' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('exposes the tooltip via aria-describedby for screen readers', () => {
    render(<FeeInfoTip fee="addOns" label="Add-on services" testId="fee-info-addons" />);
    const button = screen.getByRole('button', { name: 'More info about Add-on services' });
    const describedBy = button.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const tip = screen.getByTestId('fee-info-addons-tooltip');
    expect(tip).toHaveAttribute('id', describedBy);
    expect(tip).toHaveAttribute('role', 'tooltip');
  });
});
