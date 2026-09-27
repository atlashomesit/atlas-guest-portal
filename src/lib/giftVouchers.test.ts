import { describe, it, expect } from 'vitest';
import { generateVoucherCode, issueGiftVoucher, redeemGiftVoucher } from './giftVouchers';

describe('TASK-102265 gift voucher engine', () => {
  it('issues branded single-use codes with deterministic output', () => {
    const v = issueGiftVoucher(10000, 'friend@example.com', () => 0);
    expect(v.code).toBe(`GIFT-${'A'.repeat(8)}`);
    expect(generateVoucherCode(() => 0.999)).toMatch(/^GIFT-[A-Z2-9]{8}$/);
  });

  it('rejects below-minimum values and bad emails', () => {
    expect(() => issueGiftVoucher(100, 'friend@example.com')).toThrow();
    expect(() => issueGiftVoucher(10000, 'not-an-email')).toThrow();
  });

  it('redeems once, capped at the order total', () => {
    const v = issueGiftVoucher(10000, 'friend@example.com', () => 0);
    const r = redeemGiftVoucher(v, 6000);
    expect(r.discountInr).toBe(6000);
    expect(r.voucher.redeemed).toBe(true);
    expect(() => redeemGiftVoucher(r.voucher, 100)).toThrow();
  });
});
