/**
 * TASK-8293 — INVARIANT: the widget's rendered price line items must sum to the widget's own
 * rendered Total.
 *
 * Why this file exists as its own suite: the pre-existing parity specs check the widget's Total
 * against the SERVER's quote, and never check the Total against the lines printed directly above
 * it. That left a whole defect class invisible — `netChargeableRoomFare` re-subtracted the four
 * rule discounts (`losDiscountAmount`, `lastMinuteDiscountAmount`, `repeatGuestDiscountAmount`,
 * `longStayDiscountAmount`) that the server had ALREADY netted into `BaseAmount`, so the
 * accommodation line came out low while the Total (which prefers the server's `finalAmount`)
 * stayed right. On a default 7-night ₹3,000/night stay that is a ₹2,100 unexplained gap, and
 * TASK-4322 had removed the "Long-stay discount" row, so no line absorbed it. To a guest that
 * reads as a hidden fee — the exact opposite of the paymentRail "no surprise OTA markups" claim.
 *
 * The invariant, not any single number, is the thing being pinned: sum(line rows) === Total row,
 * read out of the rendered DOM.
 *
 * SERVER CONTRACT these fixtures encode (see `netChargeableRoomFare`'s doc comment in
 * src/api/pricingClient.ts for the full derivation):
 *   `finalAmount` = (`baseAmount` − `discountAmount`) + GST + convenience fee + tourist tax,
 *   where `baseAmount` is ALREADY net of LOS / last-minute / min-price-floor / long-stay, and
 *   `discountAmount` (the tenant GLOBAL discount) is applied AFTER `BaseAmount` is fixed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, nextFriday } from 'date-fns';
import { toISODate } from '@/utils/dateRange';
import { getIstStartOfDay } from '@/utils/date';
import type { GuestPriceBreakdown } from '@/api/pricingClient';

const mocks = vi.hoisted(() => ({
  fetchCalendarPricing: vi.fn(),
  fetchGuestPriceBreakdown: vi.fn(),
  booking: { checkIn: null as string | null, checkOut: null as string | null, guests: 2 },
}));

vi.mock('@/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasRuntimeConfig: () => true,
}));
// An ONLINE Razorpay tenant, so `hasOnlinePaymentRail()` is true and the processing-fee row
// renders — the branch where the Total prefers the server `finalAmount`.
vi.mock('@/tenant/tenantContext', () => ({
  getTenantContext: () => ({
    slug: 'atlas',
    name: 'Atlastays',
    paymentProvider: 'RAZORPAY',
    bookingMode: 'ONLINE' as const,
  }),
}));
vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `http://localhost:5120${path}`,
  getApiHeaders: () => ({}),
  getOrderRequestHeaders: () => ({}),
}));
vi.mock('@/api/availabilityCalendarClient', () => ({
  dedupedAvailabilityCalendarFetch: async () =>
    new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }),
}));
// NOTE: `netChargeableRoomFare` is deliberately NOT mocked — it is the code under test.
vi.mock('@/api/pricingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchCalendarPricing: mocks.fetchCalendarPricing,
  fetchGuestPriceBreakdown: mocks.fetchGuestPriceBreakdown,
}));
vi.mock('@/api/listingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchPublicListings: async () => [],
}));
vi.mock('@/contexts/BookingContext', () => ({
  useBooking: () => ({ booking: mocks.booking, updateBooking: vi.fn() }),
}));
vi.mock('@/contexts/ListingPhotosContext', () => ({
  useListingPhotosFromApi: () => ({ getUrlsForListingId: () => undefined }),
}));
vi.mock('@/hooks/useDailyPricingSummary', () => ({
  useDailyPricingSummary: () => ({
    data: null,
    loading: false,
    error: null,
    getListingPricing: () => ({ baseAmount: 6000, actualPrice: 6000, globalDiscountPercent: 0 }),
  }),
}));
vi.mock('@/components/FomoBar', () => ({ default: () => null }));
vi.mock('@/lib/events', () => ({ track: vi.fn() }));
vi.mock('./AtlasBookingCalendar', () => ({ AtlasBookingCalendar: () => null }));

/** Digits only, so ₹ / thin-space / comma formatting cannot break the assertion. */
const money = (text: string | null | undefined): number => Number((text ?? '').replace(/[^0-9]/g, ''));

type Scenario = {
  /** Nights in the stay. */
  nights: number;
  /** Per-night rate the CALENDAR endpoint reports (base/weekend/override minus global discount). */
  calendarPerNight: number;
  /** The `/pricing/guest-breakdown` quote the charge engine returns for this range. */
  quote: Omit<GuestPriceBreakdown, 'convenienceFeePercent'> & { convenienceFeePercent?: number };
};

/**
 * Renders the widget for `scenario` and returns the money rows it actually painted.
 * `lineTotal` sums every non-Total row, which is precisely the number a guest adds up.
 */
async function renderBreakdown(scenario: Scenario) {
  const checkIn = getIstStartOfDay(nextFriday(addDays(new Date(), 7)));
  const checkOut = addDays(checkIn, scenario.nights);
  mocks.booking.checkIn = toISODate(checkIn);
  mocks.booking.checkOut = toISODate(checkOut);

  const dateToPrice = new Map<string, number>();
  for (let i = 0; i < scenario.nights; i += 1) {
    dateToPrice.set(toISODate(addDays(checkIn, i)), scenario.calendarPerNight);
  }
  mocks.fetchCalendarPricing.mockResolvedValue({ dateToPrice, convenienceFeePercent: 3 });
  mocks.fetchGuestPriceBreakdown.mockResolvedValue({
    convenienceFeePercent: 3,
    ...scenario.quote,
  });

  const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
  await act(async () => {
    render(
      <MemoryRouter>
        <UnitBookingWidget
          listingId={7}
          propertyId={3}
          listingName="Atlas 501 PH"
          propertySlug="atlas501-ph"
          unitSlug="ph"
        />
      </MemoryRouter>,
    );
  });

  const totalLabel = await screen.findByText('Total');
  const totalRow = totalLabel.closest('.lv-price-row') as HTMLElement;
  await waitFor(() => expect(money(totalRow.querySelector('.lv-num')?.textContent)).toBeGreaterThan(1));

  const rowsContainer = totalRow.parentElement as HTMLElement;
  const allRows = Array.from(rowsContainer.querySelectorAll<HTMLElement>('.lv-price-row'));
  const itemRows = allRows.filter((r) => !r.classList.contains('lv-total'));

  // Uniform calendar rates are used throughout, so the accommodation line is the single
  // averaged `price-line-base` row. If the per-night detail rows ever appear here the sum
  // below would double-count them against the Subtotal — assert they are absent rather than
  // let the invariant quietly measure the wrong thing.
  expect(rowsContainer.querySelector('[data-testid="bw-bd-night-row-0"]')).toBeNull();
  expect(rowsContainer.querySelector('[data-testid="bw-bd-accommodation-subtotal"]')).toBeNull();

  return {
    total: money(totalRow.querySelector('.lv-num')?.textContent),
    lineTotal: itemRows.reduce((sum, r) => sum + money(r.querySelector('.lv-num')?.textContent), 0),
    accommodation: money(
      rowsContainer.querySelector('[data-testid="price-line-base"] .lv-num')?.textContent,
    ),
    labels: itemRows.map((r) => r.textContent ?? ''),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  mocks.booking.checkIn = null;
  mocks.booking.checkOut = null;
});

describe('UnitBookingWidget — TASK-8293: rendered line items sum to the rendered Total', () => {
  it('no discounts: 7 × ₹3,000', async () => {
    // base 21,000 → GST 5% 1,050 → fee 3% 630 → final 22,680.
    const { total, lineTotal, accommodation } = await renderBreakdown({
      nights: 7,
      calendarPerNight: 3000,
      quote: {
        baseAmount: 21000,
        discountAmount: 0,
        losDiscountAmount: 0,
        lastMinuteDiscountAmount: 0,
        repeatGuestDiscountAmount: 0,
        longStayDiscountAmount: 0,
        convenienceFeeAmount: 630,
        touristTaxAmount: 0,
        gstPercent: 5,
        gstAmount: 1050,
        finalAmount: 22680,
      },
    });

    expect(accommodation).toBe(21000);
    expect(lineTotal).toBe(total);
    expect(total).toBe(22680);
  });

  it('long-stay 7 nights at the DEFAULT 10% (no host configuration): the ₹2,100 gap case', async () => {
    // LongStayDiscounts.Default gives 10% at 7+ nights on EVERY unconfigured listing, so this is
    // the ordinary path, not an edge case. Gross 21,000 → server BaseAmount 18,900 (already net);
    // longStayDiscountAmount 2,100 is REPORTING METADATA. GST 5% 945, fee 3% 567, final 20,412.
    // Pre-fix the accommodation line rendered 16,800 and the lines summed to 18,312 against a
    // Total of 20,412 — the exact ₹2,100 gap TASK-8293 was raised on.
    const { total, lineTotal, accommodation } = await renderBreakdown({
      nights: 7,
      calendarPerNight: 3000, // the calendar endpoint knows nothing about long-stay
      quote: {
        baseAmount: 18900,
        discountAmount: 0,
        losDiscountAmount: 0,
        lastMinuteDiscountAmount: 0,
        repeatGuestDiscountAmount: 0,
        longStayDiscountAmount: 2100,
        convenienceFeeAmount: 567,
        touristTaxAmount: 0,
        gstPercent: 5,
        gstAmount: 945,
        finalAmount: 20412,
      },
    });

    // The long-stay discount is REFLECTED in the accommodation line (₹2,700 × 7, not ₹3,000 × 7),
    // never silently absorbed — done-when 4.
    expect(accommodation).toBe(18900);
    expect(lineTotal).toBe(total);
    expect(total).toBe(20412);
  });

  it('last-minute discount: 2 × ₹5,000 with 15% off already netted into BaseAmount', async () => {
    // Gross 10,000 → BaseAmount 8,500; lastMinuteDiscountAmount 1,500 is metadata.
    // GST 5% 425, fee 3% 255, final 9,180.
    const { total, lineTotal, accommodation } = await renderBreakdown({
      nights: 2,
      calendarPerNight: 5000,
      quote: {
        baseAmount: 8500,
        discountAmount: 0,
        losDiscountAmount: 0,
        lastMinuteDiscountAmount: 1500,
        repeatGuestDiscountAmount: 0,
        longStayDiscountAmount: 0,
        convenienceFeeAmount: 255,
        touristTaxAmount: 0,
        gstPercent: 5,
        gstAmount: 425,
        finalAmount: 9180,
      },
    });

    expect(accommodation).toBe(8500);
    expect(lineTotal).toBe(total);
    expect(total).toBe(9180);
  });

  it('floored listing: the min-price floor clamps BaseAmount, so the reported rule discount was only PARTLY realised', async () => {
    // Gross 4,000 for 2 nights; a 30% long-stay rule would have taken 1,200 off, but the
    // minimum-price floor (₹1,800/night) clamps BaseAmount at 3,600 — only ₹400 was actually
    // given. `longStayDiscountAmount` still REPORTS the full 1,200. This is why subtracting the
    // metadata is wrong rather than merely redundant: the old code produced 2,400, understating
    // the fare by ₹1,200 more than the guest ever received.
    const { total, lineTotal, accommodation } = await renderBreakdown({
      nights: 2,
      calendarPerNight: 2000,
      quote: {
        baseAmount: 3600,
        discountAmount: 0,
        losDiscountAmount: 0,
        lastMinuteDiscountAmount: 0,
        repeatGuestDiscountAmount: 0,
        longStayDiscountAmount: 1200,
        convenienceFeeAmount: 108,
        touristTaxAmount: 0,
        gstPercent: 5,
        gstAmount: 180,
        finalAmount: 3888,
      },
    });

    expect(accommodation).toBe(3600);
    expect(lineTotal).toBe(total);
    expect(total).toBe(3888);
  });

  it('tenant GLOBAL discount is applied AFTER BaseAmount, so it MUST still be subtracted here', async () => {
    // The other half of the asymmetry, guarding the over-correction: a fix that simply returned
    // `baseAmount` would render 21,000 against a Total of 20,412 and break this case.
    // BaseAmount 21,000 gross of the global discount; discountAmount 2,100 → net 18,900.
    const { total, lineTotal, accommodation } = await renderBreakdown({
      nights: 7,
      calendarPerNight: 2700, // the calendar DOES net the global discount per day
      quote: {
        baseAmount: 21000,
        discountAmount: 2100,
        losDiscountAmount: 0,
        lastMinuteDiscountAmount: 0,
        repeatGuestDiscountAmount: 0,
        longStayDiscountAmount: 0,
        convenienceFeeAmount: 567,
        touristTaxAmount: 0,
        gstPercent: 5,
        gstAmount: 945,
        finalAmount: 20412,
      },
    });

    expect(accommodation).toBe(18900);
    expect(lineTotal).toBe(total);
    expect(total).toBe(20412);
  });

  it('tourist tax is inside the server finalAmount, so it gets its own line', async () => {
    // Goa-style 5% GST + 5% tourist tax. Before TASK-8293 the widget rendered no tourist-tax row
    // at all while the Total still preferred a finalAmount that included it — a second, identical
    // "lines do not add up to the total" gap (₹500 here).
    const { total, lineTotal, accommodation } = await renderBreakdown({
      nights: 2,
      calendarPerNight: 5000,
      quote: {
        baseAmount: 10000,
        discountAmount: 0,
        losDiscountAmount: 0,
        lastMinuteDiscountAmount: 0,
        repeatGuestDiscountAmount: 0,
        longStayDiscountAmount: 0,
        convenienceFeeAmount: 300,
        touristTaxAmount: 500,
        gstPercent: 5,
        gstAmount: 500,
        finalAmount: 11300,
      },
    });

    expect(accommodation).toBe(10000);
    expect(screen.getByTestId('bw-bd-tourist-tax-row')).toBeInTheDocument();
    expect(lineTotal).toBe(total);
    expect(total).toBe(11300);
  });
});
