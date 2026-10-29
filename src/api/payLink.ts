import { buildApiUrl, getApiHeaders } from './client';

/**
 * PAY-016: the first-party pay link (`/pay/:token`). The signed token in the path is the only credential; the API
 * resolves the tenant and the booking from it and always charges the booking's CURRENT balance.
 * GET  /api/guest/payments/link/{token}        -> the stay, the host, the amount and which rail the host has
 * POST /api/guest/payments/link/{token}/order  -> starts the payment (UPI intent + QR, or the Razorpay checkout URL)
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
  /** Razorpay: the hosted checkout to send the guest to. */
  paymentUrl?: string | null;
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
