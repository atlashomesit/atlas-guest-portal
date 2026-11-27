import { describe, it, expect } from 'vitest';
import { evaluateRatePlanAdvanceWindow } from './ratePlanAdvanceWindow';

describe('MRP-044 evaluateRatePlanAdvanceWindow', () => {
  it('enforces Early-Bird minimum advance days', () => {
    const plan = { ratePlanId: 'eb', name: 'Early Bird 15%', minAdvanceDays: 14 };
    expect(evaluateRatePlanAdvanceWindow(plan, 20)).toEqual({ eligible: true, badge: 'Early-Bird' });
    expect(evaluateRatePlanAdvanceWindow(plan, 5).eligible).toBe(false);
  });

  it('enforces Last-Minute maximum advance days', () => {
    const plan = { ratePlanId: 'lm', name: 'Last Minute Deal', maxAdvanceDays: 3 };
    expect(evaluateRatePlanAdvanceWindow(plan, 2)).toEqual({ eligible: true, badge: 'Last-Minute' });
    expect(evaluateRatePlanAdvanceWindow(plan, 10).eligible).toBe(false);
  });
});
