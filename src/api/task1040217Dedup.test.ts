import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchAvailabilityRates,
  __resetAvailabilityRatesCacheForTest,
} from './availabilityRatesClient';
import {
  fetchCalendarPricing,
  __resetCalendarPricingCacheForTest,
} from './pricingClient';

describe('TASK-1040217: API request deduplication on listing detail mount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetAvailabilityRatesCacheForTest();
    __resetCalendarPricingCacheForTest();
  });

  it('deduplicates concurrent and rapid fetchAvailabilityRates calls for the same range', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        days: [{ date: '2026-12-28', available: true, bookable: true, rate: 3500 }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const [a, b, c] = await Promise.all([
      fetchAvailabilityRates({ listingId: 2549, startDate: '2026-12-01', endDate: '2027-01-30' }),
      fetchAvailabilityRates({ listingId: 2549, startDate: '2026-12-01', endDate: '2027-01-30' }),
      fetchAvailabilityRates({ listingId: 2549, startDate: '2026-12-01', endDate: '2027-01-30' }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(c).toHaveLength(1);
  });

  it('deduplicates concurrent and rapid fetchCalendarPricing calls for the same range', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [
          {
            listingId: 2549,
            days: [{ date: '2026-12-28', baseAmount: 3500, discountAmount: 0 }],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([
      fetchCalendarPricing(2549, '2026-12-01', 2),
      fetchCalendarPricing(2549, '2026-12-01', 2),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.dateToPrice.get('2026-12-28')).toBe(3500);
    expect(b.dateToPrice.get('2026-12-28')).toBe(3500);
  });
});
