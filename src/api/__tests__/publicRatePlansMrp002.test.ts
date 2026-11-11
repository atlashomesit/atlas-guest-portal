import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fetchGuestPriceBreakdown, fetchPublicListingRatePlans } from '../pricingClient';

describe('MRP-002 public rate plans & breakdown client', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches public listing rate plans with dates and guests', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 11,
          listingId: 42,
          name: 'Standard Rate (BAR)',
          isDefault: true,
          sortOrder: 0,
          baseNightlyRate: 4000,
          effectiveNightlyRate: 4000,
          totalStayRate: 8000,
          guests: 2,
          cancellationPolicy: 'Flexible',
          cancellationSummary: 'Free cancellation up to 24 hours before check-in',
          mealPlanCode: 'RO',
          mealPlanLabel: 'Room Only',
        },
        {
          id: 12,
          listingId: 42,
          name: 'Non-Refundable Saver',
          isDefault: false,
          sortOrder: 1,
          baseNightlyRate: 4000,
          effectiveNightlyRate: 3600,
          totalStayRate: 7200,
          guests: 2,
          cancellationPolicy: 'NonRefundable',
          cancellationSummary: 'Non-refundable — lowest price',
          mealPlanCode: 'BB',
          mealPlanLabel: 'Breakfast Included',
        },
      ],
    });

    const plans = await fetchPublicListingRatePlans(42, '2026-11-10', '2026-11-12', 2);
    expect(plans).toHaveLength(2);
    expect(plans[0].id).toBe(11);
    expect(plans[1].cancellationPolicy).toBe('NonRefundable');
    expect(plans[1].mealPlanLabel).toBe('Breakfast Included');
    expect(plans[1].totalStayAmount).toBe(7200);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/listings/42/rate-plans/public?checkIn=2026-11-10&checkOut=2026-11-12&guests=2'),
      expect.any(Object),
    );
  });

  it('passes listingRatePlanId to fetchGuestPriceBreakdown when provided', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        baseAmount: 7200,
        discountAmount: 0,
        convenienceFeePercent: 3,
        convenienceFeeAmount: 216,
        gstPercent: 0,
        gstAmount: 0,
        touristTaxAmount: 0,
        finalAmount: 7416,
      }),
    });

    const breakdown = await fetchGuestPriceBreakdown(42, '2026-11-10', '2026-11-12', undefined, 12);
    expect(breakdown.baseAmount).toBe(7200);
    expect(breakdown.finalAmount).toBe(7416);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('listingRatePlanId=12'),
      expect.any(Object),
    );
  });
});
