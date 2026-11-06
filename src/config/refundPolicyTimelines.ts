/**
 * TASK-7010 (AC6/AC7): single source for refund timeline copy across guest surfaces.
 * Founder ruling 2026-07-30/31: initiated within 24h; funds land in 7–10 business days. Founder ruling 2026-11-05 replaced who approves: the host, not Atlas.
 */
export const REFUND_APPROVAL_WINDOW = "within 24 hours";
export const REFUND_SETTLEMENT_DAYS = "7–10 business days";

/** GUEST-059 (founder ruled 2026-11-05): the host approves refunds. One sentence, reused everywhere. */
export const REFUND_APPROVER_SENTENCE = "Refunds are approved by your host.";

/** Property-page refund journey step 1 (TASK-1039743) */
export const REFUND_REQUEST_STEP_DESC =
  "Request cancellation from your booking confirmation; your host reviews it.";

/** Property-page refund journey step 2 */
export const REFUND_INITIATED_STEP_DESC =
  `${REFUND_APPROVER_SENTENCE} Once approved, your refund is initiated ${REFUND_APPROVAL_WINDOW}. Reference number sent to you.`;

/** Property-page refund journey step 3 */
export const REFUND_SETTLEMENT_STEP_DESC =
  `Funds reach your account in ${REFUND_SETTLEMENT_DAYS}. Timing depends on your bank.`;

/** Property-page refund journey step 4 (TASK-1039743) */
export const REFUND_CONFIRMATION_STEP_DESC =
  "By email, plus WhatsApp if you opted in.";

/** /policies and /faq canonical timeline sentence */
export const REFUND_POLICY_TIMELINE_SENTENCE =
  `${REFUND_APPROVER_SENTENCE} Where refunds are applicable, the refund is initiated ${REFUND_APPROVAL_WINDOW} of approval. Funds reach the original payment method in ${REFUND_SETTLEMENT_DAYS}.`;

/** Booking confirmation cancellation request disclosure (AC7) */
export const REFUND_CANCELLATION_REQUEST_DISCLOSURE =
  `Submitting a request does not automatically cancel your booking — your host will review it and approve any eligible refund. It is initiated ${REFUND_APPROVAL_WINDOW} of approval, and funds reach your account in ${REFUND_SETTLEMENT_DAYS}.`;

/** Post-submit confirmation message */
export const REFUND_CANCELLATION_RECEIVED_MESSAGE =
  `Cancellation request received. Your host will review it and approve any eligible refund. It is initiated ${REFUND_APPROVAL_WINDOW} of approval. Funds reach your account in ${REFUND_SETTLEMENT_DAYS}.`;
