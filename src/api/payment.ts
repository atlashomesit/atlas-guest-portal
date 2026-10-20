import { buildApiUrl, getApiHeaders, getOrderRequestHeaders } from './client';

export interface CreateOrderPayload {
  holdId?: number;
  holdToken?: string;
  bookingDraft?: {
    listingId: number;
    checkinDate: string;
    checkoutDate: string;
    guests: number;
    listingRatePlanId?: number | null;
  };
  currency?: string;
  amount?: number;
  guestInfo?: {
    name: string;
    email: string;
    phone: string;
  };
  guestConsentAccepted?: boolean;
  securityDepositAccepted?: boolean;
}

export interface UpiDeeplinkInitiatePayload {
  bookingId: number;
  amountInr?: number;
}

export interface UpiDeeplinkInitiateResponse {
  upiUri: string;
  upiVpa: string;
  payeeName: string;
  amountInr: number;
  txnRef: string;
  qrCodeUrl: string;
}

/**
 * Creates a Razorpay order (or booking hold in two-step checkout),
 * ensuring the explicit tenant slug is forwarded so tenant resolution succeeds
 * even if subdomains or custom domains are not configured.
 */
export async function createOrder(
  payload: CreateOrderPayload,
  idempotencyKey: string,
  tenantSlug?: string | null
): Promise<Response> {
  const url = buildApiUrl('/api/Razorpay/order');
  const headers = getOrderRequestHeaders(idempotencyKey, tenantSlug);
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}

/**
 * Initiates a UPI deeplink payment request and fetches the self-hosted QR code data URI.
 */
export async function initiateUpiDeeplink(
  payload: UpiDeeplinkInitiatePayload,
  tenantSlug?: string | null
): Promise<UpiDeeplinkInitiateResponse> {
  const url = buildApiUrl('/api/upi-deeplink/initiate');
  const headers = {
    ...getApiHeaders(tenantSlug),
    'Content-Type': 'application/json',
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.error || `UPI checkout initiation failed with status ${res.status}`);
  }
  return res.json() as Promise<UpiDeeplinkInitiateResponse>;
}
