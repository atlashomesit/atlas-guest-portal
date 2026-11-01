import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublicDepositOrder, DepositRequestError, verifyPublicDeposit } from './securityDepositClient';

vi.mock('./client', () => ({
  buildApiUrl: (path: string) => `https://api.example.test${path}`,
  getApiHeaders: () => ({ 'X-Tenant-Slug': 'azure' }),
}));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('securityDepositClient (TASK-10299239)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs public-order with the booking-link token and the tenant header, and reads PascalCase or camelCase', async () => {
    const fetchMock = vi.fn(async () => json({ DepositHoldId: 3, RazorpayOrderId: 'order_X', RazorpayKeyId: 'FAKE_KEY_ID_TWO', AmountPaise: 250000, Currency: 'INR' }));
    vi.stubGlobal('fetch', fetchMock);

    const order = await createPublicDepositOrder(55, 'a b+c');

    expect(order).toEqual({ depositHoldId: 3, razorpayOrderId: 'order_X', razorpayKeyId: 'FAKE_KEY_ID_TWO', amountPaise: 250000, currency: 'INR' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.test/api/deposit-holds/public-order/55?t=a%20b%2Bc');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'X-Tenant-Slug': 'azure' });
  });

  it('treats an order without an amount or key as a failure, never as something to open Checkout with', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ depositHoldId: 3, razorpayOrderId: 'order_X', razorpayKeyId: '', amountPaise: 0 })));

    await expect(createPublicDepositOrder(55, 't')).rejects.toMatchObject({ kind: 'failed' });
  });

  it.each([
    [404, { message: 'x' }, 'invalid-link'],
    [409, { message: 'already', status: 'Authorized' }, 'already-held'],
    [409, { message: 'not active' }, 'not-active'],
    [400, { message: 'No online security deposit is configured for this stay.' }, 'not-offered'],
    [500, {}, 'failed'],
  ])('maps HTTP %i to %s', async (status, body, kind) => {
    vi.stubGlobal('fetch', vi.fn(async () => json(body, status)));

    const error = await createPublicDepositOrder(1, 't').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DepositRequestError);
    expect((error as DepositRequestError).kind).toBe(kind);
  });

  it('a refused verification (400) is a plain failure, not "no deposit offered"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'Verification failed.' }, 400)));

    const error = await verifyPublicDeposit(1, 't', { depositHoldId: 3, razorpayOrderId: 'o', razorpayPaymentId: 'p', razorpaySignature: 'bad' }).catch((e: unknown) => e);

    expect((error as DepositRequestError).kind).toBe('failed');
  });

  it('POSTs public-verify with the Razorpay callback body and returns the hold status', async () => {
    const fetchMock = vi.fn(async () => json({ depositHoldId: 3, status: 'Authorized', amountInr: 2500, holdExpiresAtUtc: '2026-11-20T00:00:00Z' }));
    vi.stubGlobal('fetch', fetchMock);

    const status = await verifyPublicDeposit(55, 'tok', { depositHoldId: 3, razorpayOrderId: 'o', razorpayPaymentId: 'p', razorpaySignature: 's' });

    expect(status).toEqual({ depositHoldId: 3, status: 'Authorized', amountInr: 2500, holdExpiresAtUtc: '2026-11-20T00:00:00Z' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.test/api/deposit-holds/public-verify/55?t=tok');
    expect(JSON.parse(String(init.body))).toEqual({ depositHoldId: 3, razorpayOrderId: 'o', razorpayPaymentId: 'p', razorpaySignature: 's' });
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });
});
