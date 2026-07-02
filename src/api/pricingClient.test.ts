import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeConfig, setRuntimeConfig } from '@/runtime-config';
import { fetchPricingBreakdown } from './pricingClient';

const defaultRuntimeConfig = {
  apiBaseUrl: 'https://api.test',
};

beforeEach(() => {
  setRuntimeConfig(defaultRuntimeConfig);
});

afterEach(() => {
  clearRuntimeConfig();
  vi.unstubAllGlobals();
});

/**
 * TASK-4322 regression: fetchPricingBreakdown previously summed the per-day tenant GLOBAL
 * discount and returned it as `losDiscountAmount`. UnitBookingWidget then subtracted that
 * value a SECOND time from `breakdownPrice` (already discount-net), understating the total
 * vs. what the server actually charges. The calendar pricing DTO (CalendarPricingDayDto) has
 * no genuine LOS field, so losDiscountAmount/losDiscountPercent must always be 0 here.
 */
describe('fetchPricingBreakdown — TASK-4322 no double-counted / mislabeled LOS discount', () => {
  it('does not surface the summed global discount as losDiscountAmount/losDiscountPercent', async () => {
    const days = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-08-0${i + 1}`,
      baseAmount: 1000,
      discountAmount: 100, // 10% tenant global discount per day
      convenienceFeePercent: 3,
    }));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [{ listingId: 42, days }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPricingBreakdown({
      listingId: 42,
      checkIn: '2026-08-01',
      checkOut: '2026-08-08',
    });

    // Discount is still surfaced once as discountAmount (base - discount = finalAmount)...
    expect(result.baseAmount).toBe(7000);
    expect(result.discountAmount).toBe(700);
    expect(result.finalAmount).toBe(6300);
    // ...but NEVER re-labeled/duplicated as a LOS discount — no genuine LOS field exists
    // in the calendar DTO, so these must stay at 0 until TASK-571 adds real LOS data.
    expect(result.losDiscountAmount).toBe(0);
    expect(result.losDiscountPercent).toBe(0);
  });

  it('returns 0 LOS discount even when no global discount is configured', async () => {
    const days = [
      { date: '2026-08-01', baseAmount: 1000, discountAmount: 0, convenienceFeePercent: 3 },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ listings: [{ listingId: 7, days }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPricingBreakdown({
      listingId: 7,
      checkIn: '2026-08-01',
      checkOut: '2026-08-02',
    });

    expect(result.losDiscountAmount).toBe(0);
    expect(result.losDiscountPercent).toBe(0);
    expect(result.finalAmount).toBe(1000);
  });
});
