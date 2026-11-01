import { buildApiUrl, getApiHeaders, getOrderRequestHeaders } from './client';
import { getAgentCode } from '@/lib/agentCode';

export interface CreateOrderPayload {
  holdId?: number;
  holdToken?: string;
  bookingDraft?: {
    listingId: number;
    checkinDate: string;
    checkoutDate: string;
    guests: number;
    listingRatePlanId?: number | null;
    /** PRICE-016: the travel agent's access code, sent only with a chosen rate plan. */
    agentAccessCode?: string;
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
  /**
   * The booking's guest-link token (the order response's `bookingToken`). Required since 2026-10-29: the API answers 404 to an
   * initiate without it, so an anonymous caller can no longer probe any booking id for its amount and the host's UPI id.
   */
  bookingToken: string | null;
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
  // PRICE-016: an order that names a rate plan carries the agent's code (if the guest came through an agent's
  // link) so the server can honour an agent-only plan; a wrong or missing code books the public rate.
  const agentCode = payload.bookingDraft?.listingRatePlanId != null ? getAgentCode() : null;
  const body = agentCode && payload.bookingDraft
    ? { ...payload, bookingDraft: { ...payload.bookingDraft, agentAccessCode: agentCode } }
    : payload;
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
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

export interface UpiGuestReportedPaidResponse {
  /** Always `awaiting_host_confirmation`: the guest's word never marks a booking paid. */
  status: string;
  holdExpiresAtUtc?: string | null;
}

/**
 * PAY-010: the guest tapped "I have paid" after paying the host's UPI link / QR. Records the claim for the host to
 * confirm; the booking stays unpaid until the host does. `bookingToken` is the order response's `bookingToken`.
 */
export async function reportUpiPaid(
  bookingId: number,
  bookingToken: string | null,
  tenantSlug?: string | null
): Promise<UpiGuestReportedPaidResponse> {
  const res = await fetch(buildApiUrl('/api/upi-deeplink/guest-reported-paid'), {
    method: 'POST',
    headers: { ...getApiHeaders(tenantSlug), 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId, bookingToken }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.error || `Could not tell the host (status ${res.status}). Please try again.`);
  }
  return res.json() as Promise<UpiGuestReportedPaidResponse>;
}
