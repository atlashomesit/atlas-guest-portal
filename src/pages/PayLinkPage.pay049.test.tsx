import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PayLinkPage from './PayLinkPage';

const getPayLinkMock = vi.fn();
const createPayLinkOrderMock = vi.fn();
const verifyPayLinkPaymentMock = vi.fn();

vi.mock('../api/payLink', () => ({
  getPayLink: (...args: unknown[]) => getPayLinkMock(...args),
  createPayLinkOrder: (...args: unknown[]) => createPayLinkOrderMock(...args),
  verifyPayLinkPayment: (...args: unknown[]) => verifyPayLinkPaymentMock(...args),
  PayLinkError: class PayLinkError extends Error {
    constructor(message: string, public readonly status: number) {
      super(message);
    }
  },
}));

vi.mock('../utils/payLinkCheckout', () => ({
  openPayLinkCheckout: vi.fn(),
  PayLinkCheckoutError: class PayLinkCheckoutError extends Error {
    constructor(message: string, public readonly code: string) {
      super(message);
    }
  },
}));

vi.mock('../components/SEO', () => ({
  default: () => null,
}));

function renderPayLink() {
  return render(
    <MemoryRouter initialEntries={['/pay/tok-049']}>
      <Routes>
        <Route path="/pay/:token" element={<PayLinkPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PayLinkPage — PAY-049 partial payments & expiry countdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders expiry countdown, partial progress, validates min/max, and submits chosen partial amount', async () => {
    const expiresAtUtc = new Date(Date.now() + 2 * 3600 * 1000 + 15 * 60 * 1000).toISOString();
    getPayLinkMock.mockResolvedValue({
      bookingId: 49,
      propertyName: 'Villa Sol',
      listingName: 'Pool Villa',
      checkIn: '2026-12-01',
      checkOut: '2026-12-04',
      nights: 3,
      guestFirstName: 'Asha',
      hostName: 'Villa Sol',
      amountDueInr: 12000,
      currency: 'INR',
      mode: 'RAZORPAY',
      alreadyPaid: false,
      expiresAtUtc,
      allowPartialPayments: true,
      minPartialAmountInr: 2000,
      totalAmountInr: 20000,
      paidSoFarInr: 8000,
      remainingInr: 12000,
    });
    createPayLinkOrderMock.mockResolvedValue({
      mode: 'RAZORPAY',
      bookingId: 49,
      amountInr: 5000,
      paymentUrl: null,
    });

    renderPayLink();

    expect(await screen.findByTestId('pay-link-expiry')).toHaveTextContent(/Link expires in/i);
    expect(screen.getByTestId('pay-link-partial-progress')).toHaveTextContent(/Paid so far/i);

    const input = screen.getByTestId('pay-link-partial-amount-input') as HTMLInputElement;
    expect(input.value).toBe('12000');

    // Below minimum
    fireEvent.change(input, { target: { value: '500' } });
    expect(screen.getByTestId('pay-link-partial-error')).toHaveTextContent(/Minimum partial payment/i);
    expect(screen.getByTestId('pay-link-razorpay-pay')).toBeDisabled();

    // Above remaining
    fireEvent.change(input, { target: { value: '15000' } });
    expect(screen.getByTestId('pay-link-partial-error')).toHaveTextContent(/cannot exceed remaining/i);

    // Quick-tap Pay remaining resets to 12000
    fireEvent.click(screen.getByTestId('pay-link-pay-remaining'));
    expect(input.value).toBe('12000');
    expect(screen.queryByTestId('pay-link-partial-error')).toBeNull();

    // Enter valid partial amount 5000 and click pay
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.click(screen.getByTestId('pay-link-razorpay-pay'));

    await waitFor(() => {
      expect(createPayLinkOrderMock).toHaveBeenCalledWith('tok-049', null, 5000);
    });
  });

  it('blocks payment when link is expired', async () => {
    getPayLinkMock.mockResolvedValue({
      bookingId: 49,
      propertyName: 'Villa Sol',
      listingName: 'Pool Villa',
      checkIn: '2026-12-01',
      checkOut: '2026-12-04',
      nights: 3,
      guestFirstName: 'Asha',
      hostName: 'Villa Sol',
      amountDueInr: 12000,
      currency: 'INR',
      mode: 'RAZORPAY',
      alreadyPaid: false,
      expiresAtUtc: new Date(Date.now() - 60_000).toISOString(),
      allowPartialPayments: true,
      minPartialAmountInr: 2000,
    });

    renderPayLink();

    expect(await screen.findByTestId('pay-link-expired')).toHaveTextContent(/expired/i);
    expect(screen.queryByTestId('pay-link-razorpay-pay')).toBeNull();
    expect(screen.queryByTestId('pay-link-partial-section')).toBeNull();
  });
});
