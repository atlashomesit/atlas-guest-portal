import { buildApiUrl, getApiHeaders } from './client';

/**
 * PAY-016: the first-party pay link (`/pay/:token`). The signed token in the path is the only credential; the API
 * resolves the tenant and the booking from it and always charges the booking's CURRENT balance.
 * GET  /api/guest/payments/link/{token}        -> the stay, the host, the amount and which rail the host has
 * POST /api/guest/payments/link/{token}/order  -> starts the payment (UPI intent + QR, or the Razorpay checkout order)
 * POST /api/guest/payments/link/{token}/verify -> after Razorpay Checkout: the SERVER verifies the signature and the captured payment, then records it
 */
export type PayLinkMode = 'RAZORPAY' | 'UPI_QR' | 'UPI_DEEPLINK' | 'NONE' | 'UNAVAILABLE';

export interface PayLinkSummary {
  bookingId: number;
  propertyName: string;
  listingName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestFirstName: string;
  hostName: string;
  amountDueInr: number;
  currency: string;
  mode: PayLinkMode | string;
  alreadyPaid: boolean;
  upiVpa?: string | null;
  payeeName?: string | null;
}

export interface PayLinkOrder {
  mode: string;
  bookingId: number;
  amountInr: number;
  /** Razorpay: Razorpay's hosted pay-by-link. The fallback when the in-page checkout (razorpayOrderId) is not offered or cannot open. */
  paymentUrl?: string | null;
  /** Razorpay in-page checkout: the host's public key id, the server-created order and its amount in paise (the page never names an amount). */
  razorpayKeyId?: string | null;
  razorpayOrderId?: string | null;
  amountPaise?: number | null;
  upiUri?: string | null;
  upiVpa?: string | null;
  payeeName?: string | null;
  qrCodeUrl?: string | null;
  txnRef?: string | null;
  /** UPI: the secret the "I have paid" call (`reportUpiPaid`) and the booking page need. */
  bookingToken?: string | null;
}

/** Thrown for a bad link so the page can say so without a stack of status codes. */
export class PayLinkError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

async function readError(res: Response, fallback: string): Promise<PayLinkError> {
  const body = await res.json().catch(() => ({}));
  const message = typeof body?.message === 'string' ? body.message : fallback;
  return new PayLinkError(message, res.status);
}

const base = (token: string) => `/api/guest/payments/link/${encodeURIComponent(token)}`;

export async function getPayLink(token: string): Promise<PayLinkSummary> {
  const res = await fetch(buildApiUrl(base(token)), { headers: getApiHeaders() });
  if (res.status === 404) throw new PayLinkError('This payment link is not valid any more. Please ask your host for a new one.', 404);
  if (!res.ok) throw await readError(res, 'We could not load this payment page. Please try again.');
  return res.json() as Promise<PayLinkSummary>;
}

export async function createPayLinkOrder(token: string): Promise<PayLinkOrder> {
  const res = await fetch(buildApiUrl(`${base(token)}/order`), {
    method: 'POST',
    headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
  });
  if (res.status === 404) throw new PayLinkError('This payment link is not valid any more. Please ask your host for a new one.', 404);
  if (!res.ok) throw await readError(res, 'We could not start the payment. Please try again.');
  return res.json() as Promise<PayLinkOrder>;
}

/** What Razorpay Checkout hands back after the guest pays. None of it is trusted until the API has verified it. */
export interface RazorpayCheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PayLinkVerifyResult {
  success: boolean;
  bookingId: number;
  /** Opens the booking confirmation page (`/booking/{id}?t=...`). */
  bookingToken?: string | null;
}

/**
 * POST verify. Resolves only when the API verified the signature, read the payment back from Razorpay and recorded it. Any refusal throws a PayLinkError with a
 * plain sentence from the API (the booking stays unpaid); a network failure says so and tells the guest not to pay twice.
 */
export async function verifyPayLinkPayment(token: string, result: RazorpayCheckoutResult): Promise<PayLinkVerifyResult> {
  let res: Response;
  try {
    res = await fetch(buildApiUrl(`${base(token)}/verify`), {
      method: 'POST',
      headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      }),
    });
  } catch {
    throw new PayLinkError(
      'We could not reach the server to confirm your payment, so it is not marked paid yet. If money was taken, do not pay again - contact your host.',
      0,
    );
  }
  if (res.status === 404) throw new PayLinkError('This payment link is not valid any more. If money was taken, do not pay again - contact your host.', 404);
  if (!res.ok) {
    throw await readError(
      res,
      'We could not confirm your payment, so it is not marked paid. If money was taken, do not pay again - contact your host.',
    );
  }
  const data = (await res.json().catch(() => null)) as PayLinkVerifyResult | null;
  if (!data || data.success !== true) {
    throw new PayLinkError('We could not confirm your payment, so it is not marked paid. If money was taken, do not pay again - contact your host.', res.status);
  }
  return data;
}
