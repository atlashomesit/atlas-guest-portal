import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Source ratchet: GuestDetailsPage must convert the order response's RUPEE
 * `amount` into PAISE exactly once, at the boundary, and every downstream
 * consumer must read the converted value.
 *
 * The handleSubmit locals are function-scoped and the page mounts a full
 * router/context/Razorpay stack, so the wiring is asserted against the source
 * file — the same pattern as abandonCheckout.test.ts and the UnitBookingWidget
 * GST ratchets.
 *
 * Defect being pinned: from e30f0a88 (2026-06-02) the rupee value was assigned
 * straight into `razorpayAmountPaise`. Consequences were (1) the TASK-2875
 * divergence gate firing on every checkout above ~₹1 and (2) a 100x-understated
 * price shown at the moment of payment consent.
 */
describe('GuestDetailsPage — Razorpay amount unit boundary', () => {
  const content = readFileSync(resolve(__dirname, './GuestDetailsPage.tsx'), 'utf-8');

  it('converts the API rupee amount to paise exactly once, at the boundary', () => {
    expect(content).toContain("from '@/utils/razorpayOrderAmount'");
    // Exactly one call site — converting anywhere else would double-apply the *100.
    const conversions = content.match(/razorpayOrderAmountInrToPaise\(/g) ?? [];
    expect(conversions.length).toBe(1);
    expect(content).toMatch(/amountPaise = razorpayOrderAmountInrToPaise\(Number\(respAmountInr\)\)/);
  });

  it('names the response field as rupees so the unit mismatch is visible at the destructure', () => {
    expect(content).toContain('amount: respAmountInr');
    // The old rupee-as-paise identifier must be gone.
    expect(content).not.toMatch(/\brespAmount\b(?!Inr)/);
  });

  it('routes the divergence gate through the paise-typed helper', () => {
    expect(content).toContain('isServerTotalConfirmRequired(amountPaise, displayTotal)');
    // The original inline comparison of RUPEES against PAISE must not return.
    expect(content).not.toContain('Math.abs(amount - clientQuotePaise)');
    expect(content).not.toContain('const clientQuotePaise = Math.round(displayTotal * 100)');
  });

  it('does not weaken the divergence guard — it is still a gate, not a warning', () => {
    // A second Pay tap is still required: the gate sets the flag, stops the
    // submit, and stashes the launch for the confirming tap.
    expect(content).toMatch(
      /isServerTotalConfirmRequired\([\s\S]{0,80}\{[\s\S]{0,400}setServerTotalConfirmRequired\(true\);[\s\S]{0,120}return;/,
    );
    expect(content).toMatch(/pendingRazorpayLaunchRef\.current = \{[\s\S]{0,300}amountPaise,/);
  });

  it('feeds PAISE to every consumer of the amount', () => {
    // Razorpay checkout options take the smallest currency unit.
    expect(content).toContain('amount: Number(amountPaise)');
    // State setter is paise-named and only ever receives the converted local.
    const setterCalls = content.match(/setRazorpayAmountPaise\([^)]*\)/g) ?? [];
    expect(setterCalls.length).toBe(3); // fresh order, pending-launch resume, payment.failed resume
    for (const call of setterCalls) {
      expect(call).toBe('setRazorpayAmountPaise(amountPaise)');
    }
    // The pre-fix setter name (which held rupees) must not survive.
    expect(content).not.toMatch(/setRazorpayAmount\(/);
  });

  it('carries paise through the resume path so a retry cannot revert to rupees', () => {
    expect(content).toMatch(
      /\(\{ keyId, orderId, bookingId, amountPaise, bookingToken, idempotencyKey \} = pendingLaunch\)/,
    );
    expect(content).toMatch(/amountPaise: number;/);
  });

  it('records why the conversion exists so it is not simplified away', () => {
    expect(content).toContain('RazorpayPaymentService.cs:658');
    expect(content).toContain('RazorpayPaymentService.cs:575');
  });
});
