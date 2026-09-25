import { describe, it, expect } from 'vitest';
import { computeCheckoutTotal } from './guestPriceEstimate';

/**
 * TASK-102392 — displayed total must equal the sum of displayed line items, derived
 * strictly from the API pricing breakdown payload (server `finalAmount`) with no
 * client-side re-addition.
 *
 * Source verification 2026-09-23: `computeCheckoutTotal` already prefers the
 * server-authoritative `finalAmount` for the base-stay total (TASK-4831) and backs the
 * GST line out of it, so lines reconcile with the total. These tests pin that invariant
 * in the board's scenario shape so it cannot regress.
 */
describe('computeCheckoutTotal — TASK-102392 line-items-sum-to-total', () => {
  it('server path: displayed total equals server finalAmount layered with add-ons/promo/referral only', () => {
    // Board shape: Nights 10,000 + Cleaning(fee) 1,000 + GST 1,320 = 12,320 server-side.
    // Under ADR-0107 GST-on-top is zero; the server finalAmount is the single source of truth.
    const serverFinalAmount = 12320;
    const result = computeCheckoutTotal({
      baseAmount: 10000,
      globalDiscountAmount: 0,
      convenienceFeeAmount: 1000,
      nights: 4,
      serverFinalAmount,
      touristTaxAmount: 0,
      addOnsTotal: 0,
      promoDiscountAmount: 0,
      referralDiscountAmount: 0,
    });
    expect(result.baseStayTotal).toBe(serverFinalAmount);
    expect(result.displayTotal).toBe(serverFinalAmount);
    // No client-side re-addition: stale/divergent client inputs must NOT move the total
    // on the server path — the total comes strictly from the API payload.
    const withStaleClientInputs = computeCheckoutTotal({
      baseAmount: 99999,
      globalDiscountAmount: 88888,
      convenienceFeeAmount: 77777,
      nights: 4,
      serverFinalAmount,
      touristTaxAmount: 66666,
      addOnsTotal: 0,
      promoDiscountAmount: 0,
      referralDiscountAmount: 0,
    });
    expect(withStaleClientInputs.displayTotal).toBe(serverFinalAmount);
  });

  it('server path with add-ons and promo: total is finalAmount + addOns − discounts, nothing re-added', () => {
    const result = computeCheckoutTotal({
      baseAmount: 10000,
      globalDiscountAmount: 1000,
      convenienceFeeAmount: 900,
      nights: 3,
      serverFinalAmount: 11220,
      touristTaxAmount: 0,
      addOnsTotal: 1500,
      promoDiscountAmount: 500,
      referralDiscountAmount: 200,
    });
    expect(result.displayTotal).toBe(11220 + 1500 - 500 - 200);
  });

  it('fallback path (no server quote): lines sum exactly to the total', () => {
    const result = computeCheckoutTotal({
      baseAmount: 10000,
      globalDiscountAmount: 0,
      convenienceFeeAmount: 1000,
      nights: 4,
      serverFinalAmount: null,
      touristTaxAmount: 320,
      addOnsTotal: 0,
      promoDiscountAmount: 0,
      referralDiscountAmount: 0,
    });
    expect(result.displayTotal).toBe(
      result.discountedSubtotal + result.gstLineAmount + 1000 + result.touristTaxAmount,
    );
  });
});
