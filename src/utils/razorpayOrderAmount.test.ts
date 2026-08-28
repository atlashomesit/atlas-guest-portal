import { describe, expect, it } from 'vitest';
import {
  SERVER_TOTAL_DIVERGENCE_TOLERANCE_PAISE,
  isServerTotalConfirmRequired,
  razorpayOrderAmountInrToPaise,
} from './razorpayOrderAmount';

/**
 * Regression pin for the 100x consent-price defect (live in production
 * 2026-06-02 e30f0a88 → 2026-08-29).
 *
 * `POST /api/Razorpay/order` returns `amount` in RUPEES
 * (RazorpayPaymentService.cs:658) while creating the Razorpay order in PAISE
 * (RazorpayPaymentService.cs:575). The portal consumed the rupee value as
 * paise, so a ₹6,480 booking rendered "Pay ₹65 to confirm" and tripped the
 * divergence gate on every real checkout.
 */
describe('razorpayOrderAmountInrToPaise — the API↔portal unit boundary', () => {
  it('converts the RUPEE amount from the order response into PAISE', () => {
    // The exact value measured live on hosted QA.
    expect(razorpayOrderAmountInrToPaise(6480)).toBe(648000);
    expect(razorpayOrderAmountInrToPaise(4860)).toBe(486000);
    expect(razorpayOrderAmountInrToPaise(1)).toBe(100);
  });

  it('never returns the rupee value unchanged (the shape of the original defect)', () => {
    // Guards against a future "simplification" that drops the *100 and
    // reintroduces a 100x-understated price at the moment of payment consent.
    for (const inr of [65, 100, 4860, 6480]) {
      expect(razorpayOrderAmountInrToPaise(inr)).toBe(inr * 100);
      expect(razorpayOrderAmountInrToPaise(inr)).not.toBe(inr);
    }
  });

  it('rounds to integer paise (Razorpay rejects fractional minor units)', () => {
    expect(razorpayOrderAmountInrToPaise(6480.5)).toBe(648050);
    // 6480.49 * 100 === 648048.99999999994 in IEEE-754 — must not truncate to 648048.
    expect(razorpayOrderAmountInrToPaise(6480.49)).toBe(648049);
    expect(Number.isInteger(razorpayOrderAmountInrToPaise(1234.567))).toBe(true);
  });

  it('handles zero without inventing a charge', () => {
    expect(razorpayOrderAmountInrToPaise(0)).toBe(0);
  });
});

describe('isServerTotalConfirmRequired — TASK-2875 divergence gate', () => {
  it('does NOT fire when the server total equals the accepted quote', () => {
    // The live defect: a matching ₹6,480 quote fired the gate on every checkout
    // because 6480 (rupees) was compared against 648000 (paise).
    expect(isServerTotalConfirmRequired(razorpayOrderAmountInrToPaise(6480), 6480)).toBe(false);
    expect(isServerTotalConfirmRequired(razorpayOrderAmountInrToPaise(4860), 4860)).toBe(false);
    expect(isServerTotalConfirmRequired(razorpayOrderAmountInrToPaise(1), 1)).toBe(false);
    expect(isServerTotalConfirmRequired(razorpayOrderAmountInrToPaise(0.5), 0.5)).toBe(false);
  });

  it('tolerates rounding drift up to ±₹1 but no more', () => {
    const quoteInr = 6480;
    const serverPaise = razorpayOrderAmountInrToPaise(quoteInr);
    // Exactly ₹1 apart, both directions — inside tolerance (strict `>`).
    expect(isServerTotalConfirmRequired(serverPaise + 100, quoteInr)).toBe(false);
    expect(isServerTotalConfirmRequired(serverPaise - 100, quoteInr)).toBe(false);
    // One paise beyond ₹1 — outside tolerance.
    expect(isServerTotalConfirmRequired(serverPaise + 101, quoteInr)).toBe(true);
    expect(isServerTotalConfirmRequired(serverPaise - 101, quoteInr)).toBe(true);
  });

  it('STILL fires on a genuine divergence — the guardrail must not be neutered', () => {
    // Server re-priced upward: the guest must re-consent before Razorpay opens.
    expect(isServerTotalConfirmRequired(razorpayOrderAmountInrToPaise(7200), 6480)).toBe(true);
    // Server re-priced downward.
    expect(isServerTotalConfirmRequired(razorpayOrderAmountInrToPaise(5000), 6480)).toBe(true);
    // A small but real ₹50 difference — well above the rounding tolerance.
    expect(isServerTotalConfirmRequired(razorpayOrderAmountInrToPaise(6530), 6480)).toBe(true);
  });

  it('would have fired on the original defect had the units been left unconverted', () => {
    // Documents the production symptom: raw rupees vs a paise quote.
    const unconvertedRupees = 6480;
    expect(isServerTotalConfirmRequired(unconvertedRupees, 6480)).toBe(true);
  });

  it('expresses its tolerance in paise', () => {
    expect(SERVER_TOTAL_DIVERGENCE_TOLERANCE_PAISE).toBe(100);
  });
});
