import { describe, expect, it } from 'vitest';
import {
  accommodationGstLineAmount,
  accommodationGstSlabPercent,
  formatEstTotalInclGst,
} from './guestPriceEstimate';

describe('guestPriceEstimate GST slab (TASK-2870/2871)', () => {
  it('uses 5% at or below ₹7,500/night and 18% above', () => {
    expect(accommodationGstSlabPercent(7500)).toBe(5);
    expect(accommodationGstSlabPercent(7501)).toBe(18);
    expect(accommodationGstSlabPercent(0)).toBeNull();
  });

  it('computes additive GST on base fare', () => {
    expect(accommodationGstLineAmount(10_000, 8000)).toBe(1800);
    expect(accommodationGstLineAmount(10_000, 5000)).toBe(500);
  });

  it('formats est-total with 18% multiplier for premium nightly rates and includes 3% payment processing fee (TASK-4302)', () => {
    const label = formatEstTotalInclGst(8000, 2, (n) => `₹${n}`);
    expect(label).toContain('18% GST');
    expect(label).toContain('2 nights');
    expect(label).toContain('3% payment processing');
  });

  it('respects isGstRegistered flag — omits GST when false (TASK-4312)', () => {
    // Non-registered host: 3000 × 1 night, no GST, +3% fee = 3000 + 90 = 3090
    const labelNoGst = formatEstTotalInclGst(3000, 1, (n) => `₹${n}`, 3, false);
    expect(labelNoGst).toContain('est. total');
    expect(labelNoGst).not.toContain('GST');
    expect(labelNoGst).toContain('3% payment processing');

    // Registered host (default): same rate applies 5% GST = 3000 + 150 (GST) = 3150, +3% fee = 3150 + 95 = 3245
    const labelWithGst = formatEstTotalInclGst(3000, 1, (n) => `₹${n}`, 3, true);
    expect(labelWithGst).toContain('5% GST');
    expect(labelWithGst).toContain('3% payment processing');
  });
});
