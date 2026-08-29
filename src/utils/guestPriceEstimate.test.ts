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

    // Registered host (default): same rate applies 5% GST = 3000 + 150 (GST) = 3150; +3% fee on
    // base only (TASK-4913) = 3150 + 90 = 3240
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

  it('TASK-4832 / TASK-4913: estTotalInclGst folds in the 3% payment-processing fee on base only', () => {
    // Non-registered host: 3000 × 1 night, no GST → base 3000, +3% fee (base) = 3090.
    expect(estTotalInclGst(3000, 1, 3, false)).toBe(3090);
    // Registered host, 5% slab: 3000 × 1.05 = 3150; +3% fee of BASE (3000, not 3150) = 3150 + 90 = 3240.
    expect(estTotalInclGst(3000, 1, 3, true)).toBe(3240);
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
  it('mirrors GstInvoiceConstants.cs exactly: 0% <=1,000, 5% 1,001-7,500, 18% >7,500', () => {
    expect(accommodationGstSlabPercentForChargedRate(600)).toBe(0);
    expect(accommodationGstSlabPercentForChargedRate(1000)).toBe(0); // boundary: inclusive exempt
    expect(accommodationGstSlabPercentForChargedRate(1001)).toBe(5); // boundary: first rupee into 5%
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

  it('TASK-7543: GST band follows the CHARGED (post-discount) rate, not the published/sticker rate', () => {
    // Listing 256 repro (TASK-7011/TASK-7540): published at ₹8,000/night (18% under the old,
    // now-superseded published-rate convention) but a discount brings the actually-charged rate
    // down to ₹6,000/night. The server now bands off the CHARGED ₹6,000 → 5%
    // (GstInvoiceCalculation.ResolveCheckoutAccommodationGstPercentForChargedBase). A caller must
    // no longer pass the published rate as the override — omitting it (equivalent to passing the
    // same charged value) is what agrees with the server.
    // 6,000 * 1.05 = 6,300 + 3% of 6,000 (180) = 6,480.
    expect(estTotalInclGst(6000, 1, 3, true)).toBe(6480);
    expect(estTotalInclGst(6000, 1, 3, true, 6000)).toBe(6480);

    // Sanity: if a caller regressed to passing the published rate (8,000) as the override, it
    // would wrongly land in the 18% band (7,260) — confirm the correct (no-override) call does
    // NOT reproduce that figure, guarding against the TASK-7540 bug reappearing.
    expect(estTotalInclGst(6000, 1, 3, true, 8000)).toBe(7260);
    expect(estTotalInclGst(6000, 1, 3, true)).not.toBe(estTotalInclGst(6000, 1, 3, true, 8000));
  });

  it('defaults chargedPerNight to perNight for callers with no separate override (backward compatible)', () => {
    // Same numeric result as always passing perNight for both when no discount info exists.
    expect(estTotalInclGst(8000, 2, 3, true)).toBe(estTotalInclGst(8000, 2, 3, true, 8000));
    expect(formatEstTotalInclGst(8000, 2, (n) => `₹${n}`)).toBe(
      formatEstTotalInclGst(8000, 2, (n) => `₹${n}`, 3, true, 8000),
    );
  });

  it('TASK-7540: a discount that crosses the exempt boundary downward now DOES exempt the charged rate (inverts the old TASK-7011 expectation)', () => {
    // A listing published at ₹1,200/night (5% band under the old, now-superseded published-rate
    // convention) discounted down to a ₹900 charged rate is now GST-EXEMPT (0%), because the
    // server bands off the CHARGED ₹900, not the ₹1,200 published/sticker rate. The published rate
    // must not be passed as the override anymore.
    const total = estTotalInclGst(900, 1, 3, true);
    const label = formatEstTotalInclGst(900, 1, (n) => `₹${n}`, 3, true);
    expect(label).not.toContain('GST');
    // 900 + 3% of 900 (27) = 927, no GST line (exempt).
    expect(total).toBe(927);
  });

  it('TASK-7540: a discount pushing the charged value across the ₹1,000 exempt boundary changes the displayed GST%', () => {
    // No discount: charged stays at ₹1,050/night → 5% GST shown.
    const beforeDiscount = formatEstTotalInclGst(1050, 1, (n) => `₹${n}`, 3, true);
    expect(beforeDiscount).toContain('5% GST');

    // A discount brings the charged rate down to ₹950/night, crossing below the ₹1,000 exempt
    // threshold — the displayed GST% must change: exempt, no GST line at all.
    const afterDiscount = formatEstTotalInclGst(950, 1, (n) => `₹${n}`, 3, true);
    expect(afterDiscount).not.toContain('GST');
  });

  it('TASK-7540: a discount pushing the charged value across the ₹7,500 slab boundary changes the displayed GST%', () => {
    // No discount: charged stays at ₹7,600/night → 18% GST shown.
    const beforeDiscount = formatEstTotalInclGst(7600, 1, (n) => `₹${n}`, 3, true);
    expect(beforeDiscount).toContain('18% GST');

    // A discount brings the charged rate down to ₹7,400/night, crossing below the ₹7,500 slab
    // threshold — the displayed GST% must change from 18% to 5%.
    const afterDiscount = formatEstTotalInclGst(7400, 1, (n) => `₹${n}`, 3, true);
    expect(afterDiscount).toContain('5% GST');

    // Same boundary, exercised via a listing whose published rate (₹9,000) would have kept it at
    // 18% under the old convention — a discount landing the CHARGED rate exactly at ₹7,500 must
    // show 5%, matching ResolveCheckoutAccommodationGstPercentForChargedBase.
    const dropsIntoLowerSlab = formatEstTotalInclGst(7500, 1, (n) => `₹${n}`, 3, true);
    expect(dropsIntoLowerSlab).toContain('5% GST');
  });
});

describe('computeCheckoutTotal — TASK-4831 prefers server finalAmount over client GST-slab recompute', () => {
  it('near the ₹7,500 slab boundary the total tracks server finalAmount, not the client slab recompute', () => {
    // 2-night stay, base ₹15,001 → client per-night = round(7500.5) = 7501 → client picks the 18% slab.
    // The server actually charged 5% (its per-night bucketing lands ≤ ₹7,500), so its finalAmount reflects
    // 5% GST. Details must show the server figure, matching the widget + the Razorpay order amount.
    const convenienceFeeAmount = 473; // ~3% of (15,001 + 750)
    const serverFinalAmount = 15_001 + 750 + convenienceFeeAmount; // base + 5% GST + conv fee = 16,224

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

    // Sanity: the discarded client recompute WOULD have used 18% and diverged.
    // TASK-8294: repointed from the deleted two-band accommodationGstSlabPercent.
    expect(accommodationGstSlabPercentForChargedRate(result.perNight)).toBe(18);

    // Total equals the server-authoritative finalAmount (no divergence, no "tap Pay again").
    expect(result.displayTotal).toBe(serverFinalAmount);
    // GST line is backed out of finalAmount so base + GST + conv fee == finalAmount.
    expect(result.gstLineAmount).toBe(750);
    // Percent label reflects the slab the server actually charged (5%), not the client's 18%.
    expect(result.gstSlabPercent).toBe(5);
  });

  it('TASK-5185: tourist tax is not folded into the GST line or percent', () => {
    // Goa-style: 5% GST + 5% tourist tax on base 10_000, plus 3% convenience on base.
    const baseAmount = 10_000;
    const gstAmount = 500;
    const touristTaxAmount = 500;
    const convenienceFeeAmount = 300;
    const serverFinalAmount = baseAmount + gstAmount + touristTaxAmount + convenienceFeeAmount;

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
    expect(result.gstLineAmount).toBe(500);
    expect(result.gstSlabPercent).toBe(5);
    expect(result.touristTaxAmount).toBe(500);
  });

  it('layers add-ons, promo, and referral on top of the server finalAmount', () => {
    const serverFinalAmount = 16_224;
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

    expect(result.displayTotal).toBe(serverFinalAmount + 500 - 200 - 100); // 16,424
  });

  it('falls back to the client GST-slab recompute when no server finalAmount is present (regression guard)', () => {
    // ₹15,000 / 2 nights = ₹7,500 per night → 5% slab → GST ₹750; total = base + GST + conv fee.
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

    expect(result.gstSlabPercent).toBe(5);
    expect(result.gstLineAmount).toBe(750);
    expect(result.displayTotal).toBe(16_200);
  });

  it('keeps the client GST estimate for the line but still prefers finalAmount for the total when the backed-out GST would be negative (legacy conv-fee fallback)', () => {
    // Pathological legacy path: convenienceFeeAmount is a client fallback not baked into finalAmount,
    // so finalAmount − base − conv fee < 0. The line falls back to the client slab estimate while the
    // total still honours the server finalAmount.
    const result = computeCheckoutTotal({
      baseAmount: 7_000,
      globalDiscountAmount: 0,
      convenienceFeeAmount: 500,
      nights: 1,
      serverFinalAmount: 7_200,
      addOnsTotal: 0,
      promoDiscountAmount: 0,
      referralDiscountAmount: 0,
    });

    expect(result.gstLineAmount).toBe(350); // client 5% of ₹7,000, not a negative backed-out value
    expect(result.gstSlabPercent).toBe(5);
    expect(result.displayTotal).toBe(7_200); // total still prefers the server finalAmount
  });
});
