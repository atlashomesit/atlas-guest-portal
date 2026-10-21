import { describe, expect, it } from 'vitest';
import { allInTotalLabel, directPriceDisplay, directSavingsLabel } from './directBookingPrice';

// Founder ruling 2026-10-21. Numbers are the live Penthouse 501 quote measured on prod that day
// (2 Nov, 1 night): baseAmount 5998, discountAmount 1499.5 (25%), finalAmount 4633.46 (incl. 3% fee).
describe('directPriceDisplay', () => {
  it('shows the struck standard rate, the real nightly rate, the saving and the all-in total', () => {
    const d = directPriceDisplay({ baseAmount: 5998, discountAmount: 1499.5, finalAmount: 4633.46, nights: 1 });
    expect(d).toEqual({ standardNightly: 5998, realNightly: 4499, savingsPercent: 25, total: 4633, nights: 1 });
  });

  it('averages the nights and keeps the exact stay total', () => {
    const d = directPriceDisplay({ baseAmount: 18000, discountAmount: 4500, finalAmount: 13905, nights: 3 });
    expect(d).toEqual({ standardNightly: 6000, realNightly: 4500, savingsPercent: 25, total: 13905, nights: 3 });
  });

  it('shows no strikethrough when there is no saving', () => {
    const d = directPriceDisplay({ baseAmount: 3500, discountAmount: 0, finalAmount: 3605, nights: 1 });
    expect(d?.standardNightly).toBeNull();
    expect(d?.savingsPercent).toBe(0);
    expect(d?.realNightly).toBe(3500);
    expect(d?.total).toBe(3605);
  });

  it('falls back to base − discount when the quote has no final amount', () => {
    expect(directPriceDisplay({ baseAmount: 4000, discountAmount: 1000, finalAmount: null, nights: 1 })?.total).toBe(3000);
  });

  // TASK-10298998: a WhatsApp hand-off / pay-at-property host has no gateway, so the 3% fee inside the quote's
  // FinalAmount is never charged — the card total must equal the booking box (room price), not the quote.
  it('leaves the payment fee out when no gateway charges it (no direct discount)', () => {
    // Comfort Cove tonight: ₹4,500, fee 3% ₹135, quote ₹4,635 — the card said ₹4,635 while the box said ₹4,500.
    const d = directPriceDisplay({
      baseAmount: 4500, discountAmount: 0, finalAmount: 4635, nights: 1, paymentFeeCharged: false, paymentFeeAmount: 135,
    });
    expect(d?.total).toBe(4500);
    expect(d?.standardNightly).toBeNull();
  });

  it('leaves the payment fee out when no gateway charges it (with a direct discount)', () => {
    const d = directPriceDisplay({
      baseAmount: 10000, discountAmount: 2500, finalAmount: 7725, nights: 2, paymentFeeCharged: false, paymentFeeAmount: 225,
    });
    expect(d).toEqual({ standardNightly: 5000, realNightly: 3750, savingsPercent: 25, total: 7500, nights: 2 });
  });

  it('keeps the payment fee in when a gateway charges it (default and explicit)', () => {
    expect(directPriceDisplay({ baseAmount: 10000, discountAmount: 0, finalAmount: 10300, nights: 2 })?.total).toBe(10300);
    expect(
      directPriceDisplay({
        baseAmount: 10000, discountAmount: 2500, finalAmount: 7725, nights: 2, paymentFeeCharged: true, paymentFeeAmount: 225,
      })?.total,
    ).toBe(7725);
  });

  it('keeps tourist tax and never drops below the room price when taking the fee out', () => {
    // net 10,000 + fee 300 + tourist tax 500 = 10,800 -> no gateway: 10,500.
    expect(
      directPriceDisplay({
        baseAmount: 10000, discountAmount: 0, finalAmount: 10800, nights: 2, paymentFeeCharged: false, paymentFeeAmount: 300,
      })?.total,
    ).toBe(10500);
    expect(
      directPriceDisplay({
        baseAmount: 10000, discountAmount: 0, finalAmount: 10300, nights: 2, paymentFeeCharged: false, paymentFeeAmount: 99999,
      })?.total,
    ).toBe(10000);
  });

  it('returns null for an unpriced quote', () => {
    expect(directPriceDisplay({ baseAmount: 0, discountAmount: 0, finalAmount: 0, nights: 1 })).toBeNull();
    expect(directPriceDisplay(null)).toBeNull();
  });
});

describe('labels', () => {
  it('uses the ruled wording', () => {
    expect(directSavingsLabel(25)).toBe('25% off — booked direct');
    expect(allInTotalLabel('₹4,633', 1)).toBe('₹4,633 total · 1 night · all fees included');
    expect(allInTotalLabel('₹13,905', 3)).toBe('₹13,905 total · 3 nights · all fees included');
  });
});
