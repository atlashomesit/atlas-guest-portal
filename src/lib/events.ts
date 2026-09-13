/**
 * TASK-1480: Conversion funnel event tracking.
 * Posts events to /api/funnel-events (anonymous, fire-and-forget).
 *
 * TASK-10087: fixed anonymous vocabulary for terminal checkout outcomes. Payloads
 * carry session/listing identifiers only — never guest PII, payment/order IDs,
 * amounts, provider data, or free-text failure reasons.
 */

import { buildApiUrl, getApiHeaders } from '../api/client';

const SESSION_KEY = 'atlas_session_id';

function getSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

/**
 * TASK-10087: fixed anonymous vocabulary for terminal checkout outcomes. Each
 * checkout attempt emits at most one of these; the wire values must match
 * FunnelEventsController.TerminalCheckoutOutcomeEvents server-side.
 */
export const TerminalCheckoutOutcomeEvents = {
  PaymentModalDismissed: 'payment_modal_dismissed',
  PaymentFailed: 'payment_failed',
  HoldExpiredDuringPayment: 'hold_expired_during_payment',
  ChargedUnconfirmed: 'charged_unconfirmed',
  PaymentConfirmed: 'payment_confirmed',
} as const;

export type TerminalCheckoutOutcome =
  (typeof TerminalCheckoutOutcomeEvents)[keyof typeof TerminalCheckoutOutcomeEvents];

export function track(eventName: string, listingId?: number): void {
  try {
    fetch(buildApiUrl('/api/funnel-events'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
      body: JSON.stringify({
        eventName,
        sessionId: getSessionId(),
        listingId: listingId ?? null,
      }),
    }).catch(() => { /* fire and forget */ });
  } catch { /* ignore */ }
}
