/**
 * Razorpay order-amount unit boundary.
 *
 * ┌─ READ THIS BEFORE "SIMPLIFYING" THE *100 AWAY ─────────────────────────────┐
 * │ `POST /api/Razorpay/order` returns `amount` in RUPEES, while the Razorpay   │
 * │ order it just created is denominated in PAISE. Both facts live in the same  │
 * │ API method:                                                                │
 * │                                                                            │
 * │   atlas-api/Atlas.Api/Services/RazorpayPaymentService.cs:575                │
 * │     var orderAmountPaise = (long)(breakdown.FinalAmount * 100);  // PAISE   │
 * │                                                                            │
 * │   atlas-api/Atlas.Api/Services/RazorpayPaymentService.cs:658                │
 * │     Amount = breakdown.FinalAmount,                              // RUPEES  │
 * │                                                                            │
 * │ So the response field named `amount` is NOT the order's amount. Every       │
 * │ portal-side consumer (the divergence gate, the "Total updated" banner, the  │
 * │ Pay CTA, the Razorpay checkout options) wants PAISE. Convert exactly once,  │
 * │ here, at the boundary — never at the individual call sites.                 │
 * │                                                                            │
 * │ A field named `amount` that is rupees while its sibling order is paise is   │
 * │ the deeper wart; fixing it would be an API contract break for other         │
 * │ callers, so it is tracked as a follow-up and corrected here instead.        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * History: this conversion was MISSING from 2026-06-02 (e30f0a88) until
 * 2026-08-29. The rupee value was assigned straight into a variable named
 * `razorpayAmountPaise`, so every checkout above ~₹1 tripped the divergence
 * gate and — the serious half — showed the guest a 100x-understated price at
 * the moment of payment consent ("Pay ₹65 to confirm" for a ₹6,480 booking).
 * It hid for ~3 months because Razorpay:UseStub=true everywhere except hosted
 * QA. Naming every identifier on this path with its unit is deliberate.
 */

/** Tolerance for the server-total divergence gate: ±₹1, expressed in paise. */
export const SERVER_TOTAL_DIVERGENCE_TOLERANCE_PAISE = 100;

/**
 * Convert the RUPEE `amount` returned by `POST /api/Razorpay/order` into the
 * PAISE that every downstream consumer expects.
 *
 * Rounds because the API field is a decimal rupee value (e.g. 6480.50) and
 * paise must be an integer — Razorpay rejects fractional minor units, and
 * float multiplication alone yields values like 648049.9999999999.
 *
 * @param apiAmountInr `amount` exactly as it comes off the order response, in rupees.
 * @returns the same money in integer paise.
 */
export function razorpayOrderAmountInrToPaise(apiAmountInr: number): number {
  return Math.round(apiAmountInr * 100);
}

/**
 * TASK-2875 divergence gate: does the authoritative server total differ enough
 * from the quote the guest accepted that we must make them tap Pay a second
 * time before Razorpay opens?
 *
 * This guard exists to stop charging a guest a price they never agreed to. It
 * is intentionally strict — a ±₹1 tolerance absorbs rounding only. Fixing the
 * units of its inputs (the 2026-08-29 fix) must not, and does not, loosen it.
 *
 * @param serverAmountPaise authoritative order total in PAISE (post-conversion).
 * @param clientQuoteInr the total the guest was shown and accepted, in RUPEES.
 */
export function isServerTotalConfirmRequired(
  serverAmountPaise: number,
  clientQuoteInr: number,
): boolean {
  const clientQuotePaise = Math.round(clientQuoteInr * 100);
  return (
    Math.abs(serverAmountPaise - clientQuotePaise) >
    SERVER_TOTAL_DIVERGENCE_TOLERANCE_PAISE
  );
}
