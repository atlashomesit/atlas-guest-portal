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
