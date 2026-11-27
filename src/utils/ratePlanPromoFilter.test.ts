import { describe, it, expect } from 'vitest';
import { resolvePromoForRatePlan } from './ratePlanPromoFilter';

describe('MRP-046 resolvePromoForRatePlan', () => {
  const promo = {
    code: 'DIRECT15',
    defaultDiscountPct: 10,
    allowedRatePlanIds: ['rp-flex', 'rp-nr'],
    perPlanDiscountOverridePct: { 'rp-nr': 15 },
  };

  it('rejects rate plans outside allowedRatePlanIds', () => {
    const res = resolvePromoForRatePlan(promo, 'rp-corp');
    expect(res.valid).toBe(false);
    expect(res.discountPct).toBe(0);
  });

  it('applies per-plan discount override when configured', () => {
    expect(resolvePromoForRatePlan(promo, 'rp-nr')).toEqual({ valid: true, discountPct: 15 });
    expect(resolvePromoForRatePlan(promo, 'rp-flex')).toEqual({ valid: true, discountPct: 10 });
  });
});
