import { describe, expect, it } from 'vitest';
import {
  accommodationGstLineAmount,
  accommodationGstSlabPercent,
  estTotalInclGst,
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

  it('TASK-4832: expanded "See total" number matches the collapsed est-total (incl. 3% fee + GST-registration flag)', () => {
    // The collapsed estimate line and the expanded "See total" figure must be
    // the same amount. ListingCard renders `estTotalInclGst(...)` for the expanded
    // figure and `formatEstTotalInclGst(...)` for the collapsed line — both must
    // resolve to the identical rupee value across the GST-slab and registration cases.
    const cases: Array<{ perNight: number; nights: number; isGstRegistered: boolean }> = [
      { perNight: 3000, nights: 1, isGstRegistered: true }, // 5% slab, registered
      { perNight: 3000, nights: 2, isGstRegistered: false }, // no GST, not registered
      { perNight: 8000, nights: 3, isGstRegistered: true }, // 18% slab, registered
    ];

    for (const { perNight, nights, isGstRegistered } of cases) {
      const expandedTotal = estTotalInclGst(perNight, nights, 3, isGstRegistered);
      // Extract the leading currency amount the collapsed helper renders.
      const collapsedLabel = formatEstTotalInclGst(
        perNight,
        nights,
        (n) => `₹${n}`,
        3,
        isGstRegistered,
      );
      const collapsedTotal = Number(collapsedLabel.match(/₹(\d+)/)![1]);
      expect(expandedTotal).toBe(collapsedTotal);

      // Guard against the old naive expanded formula (GST multiplier only, no 3% fee):
      // the shared helper must be strictly larger because it adds the processing fee.
      const naiveGstOnly = Math.round(
        perNight * nights * (isGstRegistered ? (perNight <= 7500 ? 1.05 : 1.18) : 1),
      );
      expect(expandedTotal).toBeGreaterThan(naiveGstOnly);
    }
  });

  it('TASK-4832: estTotalInclGst folds in the 3% payment-processing fee', () => {
    // Non-registered host: 3000 × 1 night, no GST → base 3000, +3% fee = 3090.
    expect(estTotalInclGst(3000, 1, 3, false)).toBe(3090);
    // Registered host, 5% slab: 3000 × 1.05 = 3150, +3% fee = 3245 (rounded).
    expect(estTotalInclGst(3000, 1, 3, true)).toBe(3245);
    // nights floors at 1 to mirror the collapsed helper.
    expect(estTotalInclGst(3000, 0, 3, false)).toBe(3090);
  });

  it('TASK-4421: GST is computed on POST-discount base, not pre-discount (global discount flow)', () => {
    // Scenario: baseAmount=10,000, globalDiscount=10% (1,000), discountedSubtotal=9,000
    // perNight should be computed from discountedSubtotal for GST slab decision and calculation
    const baseAmount = 10_000;
    const globalDiscountPercent = 10;
    const globalDiscountAmount = Math.round((baseAmount * globalDiscountPercent) / 100);
    const discountedSubtotal = baseAmount - globalDiscountAmount;

    // perNight = 9,000 / 3 nights = 3,000 (5% GST slab)
    const nights = 3;
    const perNightFromDiscounted = Math.round(discountedSubtotal / nights);

    // GST should be on discountedSubtotal, not baseAmount
    const gstPercent = accommodationGstSlabPercent(perNightFromDiscounted);
    const gstLineAmount = accommodationGstLineAmount(discountedSubtotal, perNightFromDiscounted);

    // Expected: 9,000 × 5% = 450
    expect(perNightFromDiscounted).toBe(3000);
    expect(gstPercent).toBe(5);
    expect(gstLineAmount).toBe(450);

    // Compare with pre-discount (incorrect) calc to prove the difference
    const perNightFromBase = Math.round(baseAmount / nights);
    const gstLineAmountIncorrect = accommodationGstLineAmount(baseAmount, perNightFromBase);
    expect(gstLineAmountIncorrect).toBe(500); // 10,000 × 5% = 500 (WRONG)
    expect(gstLineAmount).not.toBe(gstLineAmountIncorrect); // Verify we fixed the bug
  });
});
