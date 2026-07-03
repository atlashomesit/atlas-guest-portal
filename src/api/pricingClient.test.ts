import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeConfig, setRuntimeConfig } from '@/runtime-config';
import { fetchGuestGstBreakdown, fetchPricingBreakdown } from './pricingClient';

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

/**
 * TASK-4331: fetchGuestGstBreakdown calls GET /api/pricing/guest-breakdown (PricingService.
 * GetPublicBreakdownAsync — the SAME server computation RazorpayPaymentService uses to build
 * the actual Razorpay order amount), and must surface its gstPercent/gstAmount/finalAmount
 * as-is so the widget can render the server's real charged slab instead of re-deriving one
 * client-side from a pre-adjustment per-night rate.
 */
describe('fetchGuestGstBreakdown — TASK-4331 server-sourced GST slab', () => {
  it('surfaces gstPercent/gstAmount/finalAmount from the guest-breakdown response (camelCase)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ gstPercent: 5, gstAmount: 360, finalAmount: 7560 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchGuestGstBreakdown(42, '2026-08-01', '2026-08-08');

    expect(result.gstPercent).toBe(5);
    expect(result.gstAmount).toBe(360);
    expect(result.finalAmount).toBe(7560);
  });

  it('falls back to PascalCase fields when the server returns them', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ GstPercent: 18, GstAmount: 1260, FinalAmount: 8260 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchGuestGstBreakdown(42, '2026-08-01', '2026-08-08');

    expect(result.gstPercent).toBe(18);
    expect(result.gstAmount).toBe(1260);
    expect(result.finalAmount).toBe(8260);
  });

  it('returns null fields (not 0) when the response omits them, so callers can distinguish "no data yet" from a real 0% slab', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchGuestGstBreakdown(42, '2026-08-01', '2026-08-08');

    expect(result.gstPercent).toBeNull();
    expect(result.gstAmount).toBeNull();
    expect(result.finalAmount).toBeNull();
  });
});
