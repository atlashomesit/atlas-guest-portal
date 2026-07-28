import { describe, expect, it } from 'vitest';
import {
  accommodationGstLineAmount,
  accommodationGstSlabPercent,
  accommodationGstSlabPercentForPublishedRate,
  estTotalInclGst,
  computeCheckoutTotal,
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

describe('accommodationGstSlabPercentForPublishedRate — TASK-7011 mirrors the server three-band table', () => {
  it('mirrors GstInvoiceConstants.cs exactly: 0% <=1,000, 5% 1,001-7,500, 18% >7,500', () => {
    expect(accommodationGstSlabPercentForPublishedRate(600)).toBe(0);
    expect(accommodationGstSlabPercentForPublishedRate(1000)).toBe(0); // boundary: inclusive exempt
    expect(accommodationGstSlabPercentForPublishedRate(1001)).toBe(5); // boundary: first rupee into 5%
    expect(accommodationGstSlabPercentForPublishedRate(7500)).toBe(5); // boundary: inclusive lower slab
    expect(accommodationGstSlabPercentForPublishedRate(7501)).toBe(18); // boundary: first rupee into 18%
    expect(accommodationGstSlabPercentForPublishedRate(0)).toBeNull();
    expect(accommodationGstSlabPercentForPublishedRate(-100)).toBeNull();
  });

  it('the old two-band accommodationGstSlabPercent still has NO exempt band (left unchanged for its other callers)', () => {
    // Guards the deliberate choice to leave the 2-band function alone (UnitBookingWidget's/
    // computeCheckoutTotal's client-fallback contract) rather than mutate its behavior in place —
    // it still (wrongly, for a nil-rated stay, but unchanged on purpose) returns 5%, not 0%.
    expect(accommodationGstSlabPercent(600)).toBe(5);
    expect(accommodationGstSlabPercentForPublishedRate(600)).toBe(0);
  });
});

describe('estTotalInclGst / formatEstTotalInclGst — TASK-7011 search-card estimator agrees with the server', () => {
  it('a nil-rated (<=1,000/night) stay is never labelled "incl. 5% GST"', () => {
    const label = formatEstTotalInclGst(600, 1, (n) => `₹${n}`);
    expect(label).not.toContain('GST');
    // base 600 + 3% fee (18, rounded) = 618, no GST line.
    expect(estTotalInclGst(600, 1)).toBe(618);
  });

  it("TASK-7011 four-listing repro table: post-fix client estimate matches what the server actually charges", () => {
    // Listing 252 (₹600/nt, no discount, 1 night): server charged ₹618, gstPercent 0.
    expect(estTotalInclGst(600, 1, 3, true, 600)).toBe(618);

    // Listing 253 (₹750/nt, no discount, 1 night): server gstPercent 0, final ₹772.50 (server keeps
    // paise; the card estimator has always rounded to whole rupees, matching within ₹1 rounding).
    expect(estTotalInclGst(750, 1, 3, true, 750)).toBe(773);

    // Listing 255 (₹5,625/nt, no discount, 1 night): server charged ₹6,075 at 5% — already agreed
    // pre-fix; must still agree post-fix (non-regression).
    expect(estTotalInclGst(5625, 1, 3, true, 5625)).toBe(6075);

    // Listing 256: card showed a post-discount ₹6,000/night, but the listing's PUBLISHED
    // (pre-discount) rate is above ₹7,500 (the server bands off the published rate, not the
    // discounted one it actually charges) — server applied 18%: ₹6,000 + GST(18%) ₹1,080 +
    // 3% fee ₹180 = ₹7,260. Passing perNight=6,000 (what's charged) with publishedPerNight=8,000
    // (what's advertised) reproduces the server's actual band choice.
    expect(estTotalInclGst(6000, 1, 3, true, 8000)).toBe(7260);
    // Sanity: without the published-rate distinction, 6,000 alone picks the 5% band and
    // reproduces the exact pre-fix bug's reported total (₹6,480) — proves publishedPerNight, not
    // perNight, is what must drive the band.
    expect(estTotalInclGst(6000, 1, 3, true, 6000)).toBe(6480);
  });

  it('defaults publishedPerNight to perNight for callers with no separate published-rate figure (backward compatible)', () => {
    // Same numeric result as always passing perNight for both when no discount info exists.
    expect(estTotalInclGst(8000, 2, 3, true)).toBe(estTotalInclGst(8000, 2, 3, true, 8000));
    expect(formatEstTotalInclGst(8000, 2, (n) => `₹${n}`)).toBe(
      formatEstTotalInclGst(8000, 2, (n) => `₹${n}`, 3, true, 8000),
    );
  });

  it('a discount that crosses the exempt boundary downward does not exempt a listing published above it', () => {
    // Published ₹1,200/night (5% band) discounted down to ₹900 actually charged — the guest pays
    // 5% on the discounted ₹900, not 0%, because the PUBLISHED rate (₹1,200) is what selects the
    // band, exactly mirroring the server's convention.
    const total = estTotalInclGst(900, 1, 3, true, 1200);
    const label = formatEstTotalInclGst(900, 1, (n) => `₹${n}`, 3, true, 1200);
    expect(label).toContain('5% GST');
    expect(label).not.toContain('incl. 0%');
    // 900 * 1.05 = 945, + 3% of 900 (27) = 972.
    expect(total).toBe(972);
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
    expect(accommodationGstSlabPercent(result.perNight)).toBe(18);

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
