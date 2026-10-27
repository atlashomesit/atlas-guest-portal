import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrder, initiateUpiDeeplink } from './payment';

describe('Payment API Client (TASK-10298941 & TASK-10298942)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('createOrder includes X-Tenant-Slug and Idempotency-Key headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ orderId: 'order_123' }),
    });
    globalThis.fetch = fetchMock;

    const payload = {
      holdId: 101,
      holdToken: 'token_abc',
      currency: 'INR',
    };

    await createOrder(payload, 'idemp-1234', 'testtenant');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/Razorpay/order');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Tenant-Slug']).toBe('testtenant');
    expect(init.headers['Idempotency-Key']).toBe('idemp-1234');
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it('initiateUpiDeeplink posts to /api/upi-deeplink/initiate and returns response', async () => {
    const mockResponse = {
      upiUri: 'upi://pay?pa=test@upi&pn=Host&am=5000.00&cu=INR',
      upiVpa: 'test@upi',
      payeeName: 'Host',
      amountInr: 5000,
      txnRef: 'ATL-101-12345',
      qrCodeUrl: 'data:image/svg+xml;utf8,<svg>...</svg>',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });
    globalThis.fetch = fetchMock;

    const result = await initiateUpiDeeplink({ bookingId: 101, amountInr: 5000 }, 'testtenant');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/upi-deeplink/initiate');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Tenant-Slug']).toBe('testtenant');
    expect(result).toEqual(mockResponse);
  });
});
