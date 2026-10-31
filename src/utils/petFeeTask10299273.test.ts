import { describe, expect, it } from 'vitest';
import { mapGuestPriceBreakdown } from '@/api/pricingClient';
import { resolveCheckoutChargeReconciliation } from '@/utils/guestPriceEstimate';

describe('TASK-10299273 box 2 — Pet fee on direct website bookings', () => {
  it('maps petFee from server PriceBreakdownDto when > 0 and omits it when 0', () => {
    const withPet = mapGuestPriceBreakdown({
      baseAmount: 10000,
      discountAmount: 0,
      cleaningFee: 500,
      petFee: 800,
      finalAmount: 11300,
    });
    expect(withPet.petFee).toBe(800);
    expect(withPet.cleaningFee).toBe(500);
    expect(withPet.finalAmount).toBe(11300);

    const withoutPet = mapGuestPriceBreakdown({
      baseAmount: 10000,
      discountAmount: 0,
      petFee: 0,
      finalAmount: 10000,
    });
    expect(withoutPet.petFee).toBeUndefined();
  });

  it('itemizes Pet fee in resolveCheckoutChargeReconciliation so lines sum 100% to displayTotal', () => {
    const rec = resolveCheckoutChargeReconciliation({
      baseAmount: 10000,
      cleaningFeeAmount: 500,
      petFeeAmount: 800,
      touristTaxAmount: 0,
      displayedFeeAmount: 226,
      addOnsTotal: 0,
      confirmedPromoDiscount: 0,
      referralDiscountAmount: 0,
      displayTotal: 11526,
      nights: 2,
      stayGuestCount: 2,
      hasWeekendNight: false,
    });

    expect(rec.petFeeRow).toEqual({ label: 'Pet fee', amount: 800 });
    expect(rec.reconciledIntoBaseAmount).toBe(0);
    expect(rec.effectiveBaseAmount).toBe(10000);
    expect(rec.effectiveBaseAmount + 500 + (rec.petFeeRow?.amount ?? 0) + 226).toBe(11526);
  });
});
