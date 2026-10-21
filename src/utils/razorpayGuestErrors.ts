/** TASK-1469: Map Razorpay `payment.failed` codes to short guest-facing copy. */
// Hardening for BUG-ONBOARD-1 (incident 2026-05-02). See atlas-e2e/docs/incidents/2026-05-02-property-registration-failure.md

import { getTenantContactEmail } from "@/tenant/displayBrand";

const MAP: Record<string, string> = {
  BAD_REQUEST_ERROR: 'Your bank or UPI app declined this attempt. Try another card or UPI ID.',
  GATEWAY_ERROR: 'The bank server is busy right now. Try a UPI QR code or another bank, or try again in a few minutes.',
  NETWORK_ERROR: 'We could not reach the payment network. Check your connection and try again.',
  USER_CANCELLED: 'Payment was cancelled before completion.',
};

/** PAY-004: a UPI collect request nobody approved in time (Razorpay words it in the description, not in a code of its own). */
const UPI_COLLECT_EXPIRED = 'The UPI request ran out of time. Try a UPI QR code, or pay with a card or another bank.';
const UPI_COLLECT_EXPIRY_PATTERN = /(upi|collect|vpa).*(expir|timed? ?out|time out)|(expir|timed? ?out).*(upi|collect|vpa)|payment[ _]expired/i;

export function mapRazorpayFailureCode(code: string | undefined, fallbackDescription?: string): string {
  const c = (code ?? '').trim().toUpperCase();
  if (c === "SERVER_ERROR") {
    const support = getTenantContactEmail("support");
    return `The payment service had a problem. Try a UPI QR code or another bank, or contact ${support}.`;
  }
  if (c !== 'GATEWAY_ERROR' && UPI_COLLECT_EXPIRY_PATTERN.test(fallbackDescription ?? '')) return UPI_COLLECT_EXPIRED;
  if (c && MAP[c]) return MAP[c];
  const d = (fallbackDescription ?? '').trim();
  if (d) return d;
  return 'Payment could not be completed. You can try again or pick a different payment method.';
}
