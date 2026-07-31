/**
 * TASK-7010 (AC6/AC7): single source for refund timeline copy across guest surfaces.
 * Founder ruling 2026-07-30/31: Atlas approves/initiates within 24h; funds land in 7–10 business days.
 */
export const REFUND_APPROVAL_WINDOW = "within 24 hours";
export const REFUND_SETTLEMENT_DAYS = "7–10 business days";

/** Property-page refund journey step 2 */
export const REFUND_INITIATED_STEP_DESC =
  `Atlas approves and initiates your refund ${REFUND_APPROVAL_WINDOW}. Reference number sent to you.`;

/** Property-page refund journey step 3 */
export const REFUND_SETTLEMENT_STEP_DESC =
  `Funds reach your account in ${REFUND_SETTLEMENT_DAYS}. Timing depends on your bank.`;

/** /policies and /faq canonical timeline sentence */
export const REFUND_POLICY_TIMELINE_SENTENCE =
  `Where refunds are applicable, we approve and initiate the refund ${REFUND_APPROVAL_WINDOW} after confirming your cancellation. Funds reach the original payment method in ${REFUND_SETTLEMENT_DAYS}.`;

/** Booking confirmation cancellation request disclosure (AC7) */
export const REFUND_CANCELLATION_REQUEST_DISCLOSURE =
  `Submitting a request does not automatically cancel your booking — our team will review it, approve and initiate any eligible refund ${REFUND_APPROVAL_WINDOW}, and funds reach your account in ${REFUND_SETTLEMENT_DAYS}.`;

/** Post-submit confirmation message */
export const REFUND_CANCELLATION_RECEIVED_MESSAGE =
  `Cancellation request received. We'll review and approve any eligible refund ${REFUND_APPROVAL_WINDOW}. Funds reach your account in ${REFUND_SETTLEMENT_DAYS}.`;
