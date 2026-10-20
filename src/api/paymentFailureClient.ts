import { buildApiUrl, getApiHeaders } from '@/api/client';

/**
 * GUEST-028 (founder ruling 2026-10-19): tell Atlas what Razorpay said when a payment failed in the checkout window, and which website the
 * checkout ran on. Razorpay's own webhook only reaches Atlas when the host's dashboard sends it, so this report (authorised by the booking's
 * own guest-link token, like abandon-checkout) is the one that proves a "Business - Website Mismatch" refusal.
 */
export interface PaymentFailureDetails {
  code?: string | null;
  description?: string | null;
  source?: string | null;
  step?: string | null;
  reason?: string | null;
  method?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
}

/** The shape of Razorpay's `payment.failed` event (all of it optional: it is third-party data, never trusted). */
export interface RazorpayFailedEvent {
  error?: {
    code?: unknown;
    description?: unknown;
    source?: unknown;
    step?: unknown;
    reason?: unknown;
    metadata?: { order_id?: unknown; payment_id?: unknown };
  };
}

/** Razorpay's event, flattened to plain strings (anything that is not a string is dropped). */
export function failureDetailsFromRazorpayEvent(event: unknown): PaymentFailureDetails {
  const err = (event as RazorpayFailedEvent | null | undefined)?.error;
  const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    code: s(err?.code),
    description: s(err?.description),
    source: s(err?.source),
    step: s(err?.step),
    reason: s(err?.reason),
    orderId: s(err?.metadata?.order_id),
    paymentId: s(err?.metadata?.payment_id),
  };
}

/** Fire-and-forget: a failed report must never disturb the guest, who is looking at "Payment didn't go through". */
export function reportPaymentFailure(
  bookingId: number | string | null | undefined,
  token: string | null | undefined,
  tenantSlug: string | null | undefined,
  failure: PaymentFailureDetails,
): void {
  const id = Number(bookingId);
  const t = typeof token === 'string' ? token.trim() : '';
  if (!Number.isFinite(id) || id <= 0 || !t) return;
  try {
    const url = buildApiUrl(`/api/guest/bookings/${id}/payment-failure?t=${encodeURIComponent(t)}`);
    void fetch(url, {
      method: 'POST',
      headers: { ...getApiHeaders(tenantSlug), 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        razorpayOrderId: failure.orderId ?? null,
        razorpayPaymentId: failure.paymentId ?? null,
        errorCode: failure.code ?? null,
        errorDescription: failure.description ?? null,
        errorSource: failure.source ?? null,
        errorStep: failure.step ?? null,
        errorReason: failure.reason ?? null,
        method: failure.method ?? null,
        websiteHost: typeof window !== 'undefined' ? window.location.host : null,
      }),
    }).catch(() => { /* fire-and-forget */ });
  } catch {
    /* fire-and-forget */
  }
}
