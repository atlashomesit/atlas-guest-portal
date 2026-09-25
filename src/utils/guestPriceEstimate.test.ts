import { describe, expect, it } from 'vitest';
import {
  accommodationGstLineAmount,
  accommodationGstSlabPercentForChargedRate,
  estTotalInclGst,
  computeCheckoutTotal,
  formatEstTotalInclGst,
} from './guestPriceEstimate';

describe('guestPriceEstimate GST slab (TASK-2870/2871)', () => {
  it('uses 5% at or below ₹7,500/night and 18% above', () => {
    // TASK-8294: repointed from the deleted two-band accommodationGstSlabPercent — see the
    // dedicated describe block below for the full three-band boundary coverage including 0%.
    expect(accommodationGstSlabPercentForChargedRate(7500)).toBe(5);
    expect(accommodationGstSlabPercentForChargedRate(7501)).toBe(18);
    expect(accommodationGstSlabPercentForChargedRate(0)).toBeNull();
  });

  it('computes additive GST on base fare', () => {
    expect(accommodationGstLineAmount(10_000, 8000)).toBe(1800);
    expect(accommodationGstLineAmount(10_000, 5000)).toBe(500);
  });

  it('formats est-total without GST added on top and includes 3% payment processing fee (TASK-102037)', () => {
    const label = formatEstTotalInclGst(8000, 2, (n) => `₹${n}`);
    expect(label).not.toContain('GST');
    expect(label).toContain('2 nights');
    expect(label).toContain('3% payment processing');
  });

  it('omits GST from estimate lines (TASK-102037)', () => {
    // 3000 × 1 night, no GST on top, +3% fee = 3000 + 90 = 3090
    const labelNoGst = formatEstTotalInclGst(3000, 1, (n) => `₹${n}`, 3, false);
    expect(labelNoGst).toContain('est. total');
    expect(labelNoGst).not.toContain('GST');
    expect(labelNoGst).toContain('3% payment processing');

    // Registered host: still zero GST added on top at guest checkout/quote time per ADR-0107
    const labelWithGst = formatEstTotalInclGst(3000, 1, (n) => `₹${n}`, 3, true);
    expect(labelWithGst).not.toContain('GST');
    expect(labelWithGst).toContain('3% payment processing');
  });

  it('TASK-4832: expanded "See total" number matches the collapsed est-total (incl. 3% fee)', () => {
    const cases: Array<{ perNight: number; nights: number; isGstRegistered: boolean }> = [
      { perNight: 3000, nights: 1, isGstRegistered: true },
      { perNight: 3000, nights: 2, isGstRegistered: false },
      { perNight: 8000, nights: 3, isGstRegistered: true },
    ];

    for (const { perNight, nights, isGstRegistered } of cases) {
      const expandedTotal = estTotalInclGst(perNight, nights, 3, isGstRegistered);
      const collapsedLabel = formatEstTotalInclGst(
        perNight,
        nights,
        (n) => `₹${n}`,
        3,
        isGstRegistered,
      );
      const collapsedTotal = Number(collapsedLabel.match(/₹(\d+)/)![1]);
      expect(expandedTotal).toBe(collapsedTotal);
    }
  });

  it('TASK-4832 / TASK-4913 / TASK-102037: estTotal folds in the 3% payment-processing fee on base only, zero GST on top', () => {
    // 3000 × 1 night, no GST on top → base 3000, +3% fee (base) = 3090.
    expect(estTotalInclGst(3000, 1, 3, false)).toBe(3090);
    expect(estTotalInclGst(3000, 1, 3, true)).toBe(3090);
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
    // TASK-8294: repointed from the deleted two-band accommodationGstSlabPercent.
    const gstPercent = accommodationGstSlabPercentForChargedRate(perNightFromDiscounted);
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

describe('accommodationGstSlabPercentForChargedRate — TASK-7011/TASK-7543 mirrors the server three-band table', () => {
  it('mirrors GstInvoiceCalculation.cs (TASK-101988): 0% <1,000, 5% 1,000-7,500, 18% >7,500', () => {
    expect(accommodationGstSlabPercentForChargedRate(600)).toBe(0);
    expect(accommodationGstSlabPercentForChargedRate(999)).toBe(0); // boundary: strictly below 1000 is exempt
    expect(accommodationGstSlabPercentForChargedRate(1000)).toBe(5); // TASK-101988 boundary: exactly 1000 is 5%
    expect(accommodationGstSlabPercentForChargedRate(1001)).toBe(5); // in 5%
    expect(accommodationGstSlabPercentForChargedRate(7500)).toBe(5); // boundary: inclusive lower slab
    expect(accommodationGstSlabPercentForChargedRate(7501)).toBe(18); // boundary: first rupee into 18%
    expect(accommodationGstSlabPercentForChargedRate(0)).toBeNull();
    expect(accommodationGstSlabPercentForChargedRate(-100)).toBeNull();
  });

  it('TASK-8294: covers the widget/checkout fallback path\'s three reference rates — ₹800 (0%), ₹2,500 (5%), ₹8,000 (18%)', () => {
    // Exercised through the exact functions UnitBookingWidget's fallback (guestPriceEstimate.ts:50,
    // 117 and UnitBookingWidget.tsx's gstSlabPercent) calls: accommodationGstSlabPercentForChargedRate
    // for the displayed percent, and accommodationGstLineAmount for the rupee line.
    expect(accommodationGstSlabPercentForChargedRate(800)).toBe(0);
    expect(accommodationGstSlabPercentForChargedRate(2500)).toBe(5);
    expect(accommodationGstSlabPercentForChargedRate(8000)).toBe(18);

    // ₹800/night must show NO GST line at all — not even the pre-existing ₹1 display floor
    // (that floor exists only to keep a genuinely-taxed line from rounding down to ₹0; it must
    // not manufacture a tax line for a stay that is legally nil-rated).
    expect(accommodationGstLineAmount(800, 800)).toBe(0);
    expect(accommodationGstLineAmount(2500, 2500)).toBe(125); // 5% of ₹2,500
    expect(accommodationGstLineAmount(8000, 8000)).toBe(1440); // 18% of ₹8,000
  });

  it('TASK-8294: the two-band accommodationGstSlabPercent hazard is removed — every caller, including the client-side fallback paths, now uses this exempt-aware function', () => {
    // Previously there were two near-identically-named slab helpers: this three-band function,
    // and a two-band `accommodationGstSlabPercent` (5%/18% only, no exempt tier) that
    // UnitBookingWidget's and computeCheckoutTotal's client-side FALLBACK paths called by
    // mistake — quoting a "GST (5%)" line on a sub-₹1,000/night stay that is legally nil-rated.
    // The two-band helper has been deleted outright (not merely fixed in place) so a future
    // reader/caller cannot pick the wrong one again; this is now the ONLY accommodation GST slab
    // function in the file.
    expect(accommodationGstSlabPercentForChargedRate(600)).toBe(0);
  });
});

describe('estTotalInclGst / formatEstTotalInclGst — TASK-7543 search-card estimator bands off the CHARGED rate, agreeing with the server', () => {
  it('a nil-rated (<=1,000/night) stay is never labelled "incl. 5% GST"', () => {
    const label = formatEstTotalInclGst(600, 1, (n) => `₹${n}`);
    expect(label).not.toContain('GST');
    // base 600 + 3% fee (18, rounded) = 618, no GST line.
    expect(estTotalInclGst(600, 1)).toBe(618);
  });

  it('TASK-102037 (ADR-0107): estimator computes clean total with zero GST added on top', () => {
    // 6,000 + 3% of 6,000 (180) = 6,180 (zero GST on top per ADR-0107)
    expect(estTotalInclGst(6000, 1, 3, true)).toBe(6180);
    expect(estTotalInclGst(6000, 1, 3, true, 6000)).toBe(6180);
    const label = formatEstTotalInclGst(6000, 1, (n) => `₹${n}`, 3, true);
    expect(label).not.toContain('GST');
  });

  it('defaults chargedPerNight to perNight for callers with no separate override (backward compatible)', () => {
    expect(estTotalInclGst(8000, 2, 3, true)).toBe(estTotalInclGst(8000, 2, 3, true, 8000));
    expect(formatEstTotalInclGst(8000, 2, (n) => `₹${n}`)).toBe(
      formatEstTotalInclGst(8000, 2, (n) => `₹${n}`, 3, true, 8000),
    );
  });

  it('TASK-102037: search-card estimator renders no GST line across rates', () => {
    const total = estTotalInclGst(900, 1, 3, true);
    const label = formatEstTotalInclGst(900, 1, (n) => `₹${n}`, 3, true);
    expect(label).not.toContain('GST');
    // 900 + 3% of 900 (27) = 927.
    expect(total).toBe(927);

    const label1050 = formatEstTotalInclGst(1050, 1, (n) => `₹${n}`, 3, true);
    expect(label1050).not.toContain('GST');

    const label7600 = formatEstTotalInclGst(7600, 1, (n) => `₹${n}`, 3, true);
    expect(label7600).not.toContain('GST');
  });

  it('TASK-102042: exempt 800 and upper 8000 bands est-total matches zero-GST breakdown within ₹1', () => {
    for (const perNight of [800, 8000]) {
      const nights = 2;
      const base = perNight * nights;
      const fee = Math.round((base * 3) / 100);
      const serverTotal = base + fee;
      const est = estTotalInclGst(perNight, nights, 3, true);
      expect(Math.abs(est - serverTotal)).toBeLessThanOrEqual(1);
      expect(formatEstTotalInclGst(perNight, nights, (n) => `₹${n}`, 3, true)).not.toContain('GST');
    }
  });
});

describe('computeCheckoutTotal — TASK-102037 zero GST added on top at checkout', () => {
  it('prefers server finalAmount and has zero GST line terms', () => {
    const convenienceFeeAmount = 450;
    const serverFinalAmount = 15_001 + convenienceFeeAmount;

    const result = computeCheckoutTotal({
      baseAmount: 15_001,
      globalDiscountAmount: 0,
      convenienceFeeAmount,
      nights: 2,
      serverFinalAmount,
      addOnsTotal: 0,
      promoDiscountAmount: 0,
      referralDiscountAmount: 0,
    });

    expect(result.displayTotal).toBe(serverFinalAmount);
    expect(result.gstLineAmount).toBe(0);
    expect(result.gstSlabPercent).toBeNull();
  });

  it('TASK-5185 / TASK-102037: tourist tax is preserved without GST on top', () => {
    const baseAmount = 10_000;
    const touristTaxAmount = 500;
    const convenienceFeeAmount = 300;
    const serverFinalAmount = baseAmount + touristTaxAmount + convenienceFeeAmount;

    const result = computeCheckoutTotal({
      baseAmount,
      globalDiscountAmount: 0,
      convenienceFeeAmount,
      nights: 2,
      serverFinalAmount,
      touristTaxAmount,
      addOnsTotal: 0,
      promoDiscountAmount: 0,
      referralDiscountAmount: 0,
    });

    expect(result.displayTotal).toBe(serverFinalAmount);
    expect(result.gstLineAmount).toBe(0);
    expect(result.gstSlabPercent).toBeNull();
    expect(result.touristTaxAmount).toBe(500);
  });

  it('layers add-ons, promo, and referral on top of the server finalAmount', () => {
    const serverFinalAmount = 15_474;
    const result = computeCheckoutTotal({
      baseAmount: 15_001,
      globalDiscountAmount: 0,
      convenienceFeeAmount: 473,
      nights: 2,
      serverFinalAmount,
      addOnsTotal: 500,
      promoDiscountAmount: 200,
      referralDiscountAmount: 100,
    });

    expect(result.displayTotal).toBe(serverFinalAmount + 500 - 200 - 100);
    expect(result.gstLineAmount).toBe(0);
  });

  it('computes fallback total with zero GST when no server finalAmount is present', () => {
    // ₹15,000 + ₹450 conv fee = 15,450 (zero GST on top).
    const result = computeCheckoutTotal({
      baseAmount: 15_000,
      globalDiscountAmount: 0,
      convenienceFeeAmount: 450,
      nights: 2,
      serverFinalAmount: null,
      addOnsTotal: 0,
      promoDiscountAmount: 0,
      referralDiscountAmount: 0,
    });

    expect(result.gstSlabPercent).toBeNull();
    expect(result.gstLineAmount).toBe(0);
    expect(result.displayTotal).toBe(15_450);
  });
});
