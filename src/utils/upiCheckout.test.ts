import { describe, expect, it } from 'vitest';
import { parseUpiOrder } from './upiCheckout';

describe('parseUpiOrder (PAY-010)', () => {
  it('a Razorpay order is not a UPI order', () => {
    expect(parseUpiOrder({ keyId: 'rzp_test_x', orderId: 'order_x', provider: null })).toBeNull();
    expect(parseUpiOrder({ keyId: 'rzp_test_x', orderId: 'order_x', provider: 'RAZORPAY' })).toBeNull();
  });

  it('a UPI order carries the link, the address, the inline QR and the reference', () => {
    expect(
      parseUpiOrder({
        provider: 'upi_deeplink', upiUri: 'upi://pay?pa=h%40ok&am=10.00', upiVpa: 'h@ok', orderId: 'ATL-1-00001',
        qrCodeUrl: 'data:image/svg+xml;base64,AA==',
      }),
    ).toEqual({
      provider: 'UPI_DEEPLINK', upiUri: 'upi://pay?pa=h%40ok&am=10.00', upiVpa: 'h@ok', reference: 'ATL-1-00001',
      qrCodeUrl: 'data:image/svg+xml;base64,AA==',
    });
  });

  it('never shows a remote QR image (it could carry someone else\'s UPI address)', () => {
    const o = parseUpiOrder({ provider: 'UPI_QR', upiUri: 'upi://pay?pa=h%40ok', upiVpa: 'h@ok', qrCodeUrl: 'https://evil.example/qr.png' });
    expect(o?.qrCodeUrl).toBe('');
  });

  it('a UPI provider with no usable link throws instead of falling back to Razorpay', () => {
    expect(() => parseUpiOrder({ provider: 'UPI_QR', upiUri: '', upiVpa: 'h@ok' })).toThrow(/UPI payment details are missing/);
    expect(() => parseUpiOrder({ provider: 'UPI_QR', upiUri: 'https://x', upiVpa: 'h@ok' })).toThrow();
  });
});
