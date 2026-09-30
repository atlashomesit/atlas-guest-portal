import { describe, expect, it } from 'vitest';
import { feePercent, paymentFeeCopy } from './paymentFeeCopy';
import { formatEstTotalInclGst } from './guestPriceEstimate';

describe('fee claims only use supplied metadata', () => {
  it('uses the quote amount for absorbed and amount-only fees', () => {
    expect(paymentFeeCopy({ percent: 1.25, amount: 0 })).toBe('No payment-processing fee.');
    expect(paymentFeeCopy({ percent: null, amount: 87.5 })).toContain('₹87.50 payment-processing fee');
    expect(paymentFeeCopy({ percent: 0, amount: 87.5 })).not.toContain('No payment');
    expect(paymentFeeCopy({ percent: 0, amount: 87.5 })).not.toContain('0%');
  });
  it('uses an unknown state instead of inventing zero or a default percentage', () => {
    expect(feePercent(Number.NaN)).toBeNull();
    expect(paymentFeeCopy({ percent: null })).toBe('Any payment-processing fee is shown before payment.');
    expect(formatEstTotalInclGst(7000, 1, String)).toBe('Total confirmed after choosing dates.');
    expect(formatEstTotalInclGst(7000, 1, String, 1.25)).toContain('7088 est. total 1.25%');
    expect(formatEstTotalInclGst(7000, 1, String, 0)).toContain('7000 est. total');
  });
});
