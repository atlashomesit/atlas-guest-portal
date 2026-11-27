import { describe, it, expect } from 'vitest';
import { resolveRatePlanPrepayment } from './ratePlanPrepayment';

describe('MRP-052 resolveRatePlanPrepayment', () => {
  it('overrides property-wide payment rule with rate-plan deposit policy', () => {
    const res = resolveRatePlanPrepayment(
      10000,
      { mode: 'FULL_PREPAYMENT' },
      { mode: 'PARTIAL_DEPOSIT', depositPct: 30 }
    );
    expect(res.dueNowInr).toBe(3000);
    expect(res.dueAtPropertyInr).toBe(7000);
    expect(res.summaryLabel).toContain('30%');
  });

  it('falls back to property default when rate plan has no override', () => {
    const res = resolveRatePlanPrepayment(5000, { mode: 'PAY_AT_PROPERTY' }, null);
    expect(res.dueNowInr).toBe(0);
    expect(res.dueAtPropertyInr).toBe(5000);
  });
});
