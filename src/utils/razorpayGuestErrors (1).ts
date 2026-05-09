/** TASK-1469: Map Razorpay `payment.failed` codes to short guest-facing copy. */
// Hardening for BUG-ONBOARD-1 (incident 2026-05-02). See atlas-e2e/docs/incidents/2026-05-02-property-registration-failure.md

const MAP: Record<string, string> = {
  BAD_REQUEST_ERROR: 'Your bank or UPI app declined this attempt. Try another card or UPI ID.',
  GATEWAY_ERROR: 'The payment gateway had a problem. Please try again in a few minutes.',
  NETWORK_ERROR: 'We could not reach the payment network. Check your connection and try again.',
  SERVER_ERROR: 'The payment service returned an error. Try again shortly or contact support@atlashomestays.com.',
  USER_CANCELLED: 'Payment was cancelled before completion.',
};

export function mapRazorpayFailureCode(code: string | undefined, fallbackDescription?: string): string {
  const c = (code ?? '').trim().toUpperCase();
  if (c && MAP[c]) return MAP[c];
  const d = (fallbackDescription ?? '').trim();
  if (d) return d;
  return 'Payment could not be completed. You can try again or pick a different payment method.';
}
