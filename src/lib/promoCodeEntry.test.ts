import { describe, it, expect } from 'vitest';
import { applyPromoCode, matchPromoCode, normalizePromoCode } from './promoCodeEntry';

describe('TASK-102390 promo code case-insensitive entry', () => {
  it('normalizes lowercase + padded input to the stored code', () => {
    expect(normalizePromoCode('  diwali20 ')).toBe('DIWALI20');
    expect(matchPromoCode(['DIWALI20'], 'diwali20')).toBe('DIWALI20');
    expect(matchPromoCode(['DIWALI20'], '  Diwali20')).toBe('DIWALI20');
  });

  it('still rejects unknown codes, and badges valid ones', () => {
    expect(matchPromoCode(['DIWALI20'], 'HOLI99')).toBeNull();
    expect(applyPromoCode(['DIWALI20'], 'diwali20', 'You save Rs.2,000')).toEqual({
      applied: true, code: 'DIWALI20', badge: 'You save Rs.2,000',
    });
  });
});
