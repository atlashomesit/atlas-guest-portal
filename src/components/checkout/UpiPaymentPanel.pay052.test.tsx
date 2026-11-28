import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { settle } from '@/test/settle';
import { UpiPaymentPanel } from './UpiPaymentPanel';
import { parseUpiOrder } from '@/utils/upiCheckout';

describe('UpiPaymentPanel — PAY-052 Razorpay Dynamic UPI QR auto-confirm polling', () => {
  it('renders dynamic QR with live polling status, hides "I have paid", and auto-confirms on paid status', async () => {
    vi.useFakeTimers();
    try {
      const pollStatus = vi
        .fn<() => Promise<'pending' | 'paid' | 'expired'>>()
        .mockResolvedValueOnce('pending')
        .mockResolvedValueOnce('paid');
      const onAutoConfirmed = vi.fn();

      render(
        <UpiPaymentPanel
          order={{
            provider: 'RAZORPAY_DYNAMIC_QR',
            upiUri: '',
            upiVpa: '',
            qrCodeUrl: '',
            qrImageUrl: 'https://rzp.io/i/qr_test_123',
            qrCodeId: 'qr_test_123',
            isDynamicQr: true,
            reference: 'ATL-52-1',
          }}
          amountInr={4500}
          payeeName="Villa Sol"
          countdown={null}
          holdActive={false}
          showHold={false}
          isMobile={false}
          onIHavePaid={vi.fn()}
          isDynamicQr
          pollStatus={pollStatus}
          pollIntervalMs={500}
          onAutoConfirmed={onAutoConfirmed}
        />,
      );

      expect(screen.getByTestId('upi-pay-qr')).toHaveAttribute('src', 'https://rzp.io/i/qr_test_123');
      expect(screen.getByTestId('upi-dynamic-qr-status')).toHaveTextContent(/Waiting for UPI confirmation/i);
      expect(screen.queryByTestId('upi-pay-i-have-paid')).toBeNull();

      await settle();
      await vi.advanceTimersByTimeAsync(1100);
      await settle();

      expect(screen.getByTestId('upi-dynamic-qr-confirmed')).toHaveTextContent(/Payment confirmed/i);
      expect(onAutoConfirmed).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('parses RAZORPAY_DYNAMIC_QR order via parseUpiOrder', () => {
    const parsed = parseUpiOrder({
      provider: 'RAZORPAY_DYNAMIC_QR',
      isDynamicQr: true,
      qrCodeId: 'qr_abc',
      qrImageUrl: 'https://rzp.io/i/qr_abc',
      orderId: 'ATL-52-2',
    });
    expect(parsed).toMatchObject({
      provider: 'RAZORPAY_DYNAMIC_QR',
      isDynamicQr: true,
      qrCodeId: 'qr_abc',
      qrImageUrl: 'https://rzp.io/i/qr_abc',
      reference: 'ATL-52-2',
    });
  });
});
