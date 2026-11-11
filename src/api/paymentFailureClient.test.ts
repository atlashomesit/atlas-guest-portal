import { afterEach, describe, expect, it, vi } from 'vitest';
import { failureDetailsFromRazorpayEvent, reportPaymentFailure } from './paymentFailureClient';

describe('failureDetailsFromRazorpayEvent', () => {
  it('flattens a recorded "Website Mismatch" payment.failed event', () => {
    const details = failureDetailsFromRazorpayEvent({
      error: {
        code: 'BAD_REQUEST_ERROR',
        description: 'Payment processing cancelled by user',
        source: 'business',
        step: 'payment_authorization',
        reason: 'website_mismatch',
        metadata: { order_id: 'order_Abc', payment_id: 'pay_Xyz' },
      },
    });
    expect(details).toEqual({
      code: 'BAD_REQUEST_ERROR',
      description: 'Payment processing cancelled by user',
      source: 'business',
      step: 'payment_authorization',
      reason: 'website_mismatch',
      orderId: 'order_Abc',
      paymentId: 'pay_Xyz',
    });
  });

  it('drops anything that is not a string and survives junk', () => {
    expect(failureDetailsFromRazorpayEvent(null)).toEqual({
      code: null, description: null, source: null, step: null, reason: null, orderId: null, paymentId: null,
    });
    expect(failureDetailsFromRazorpayEvent({ error: { code: 42, description: { x: 1 }, reason: '  ' } })).toMatchObject({
      code: null, description: null, reason: null,
    });
  });
});

describe('reportPaymentFailure', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts to the booking\'s payment-failure route with the guest-link token and the page\'s own host', () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    reportPaymentFailure(7001, 'tok-1', 'atlas', { code: 'BAD_REQUEST_ERROR', reason: 'website_mismatch', orderId: 'order_Abc' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/api/guest/bookings/7001/payment-failure?t=tok-1');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      razorpayOrderId: 'order_Abc',
      errorCode: 'BAD_REQUEST_ERROR',
      errorReason: 'website_mismatch',
      websiteHost: window.location.host,
    });
    vi.unstubAllGlobals();
  });

  it('does nothing without a booking id or token (nothing to authorise it with)', () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    reportPaymentFailure(null, 'tok', null, { code: 'X' });
    reportPaymentFailure(7001, '', null, { code: 'X' });
    reportPaymentFailure(0, 'tok', null, { code: 'X' });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('never throws, even when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    expect(() => reportPaymentFailure(7001, 'tok', null, { code: 'X' })).not.toThrow();
    await Promise.resolve();
    vi.unstubAllGlobals();
  });
});
