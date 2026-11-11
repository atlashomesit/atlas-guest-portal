/**
 * HSL-010 — a HostelDorm quote is priced per BED. The server returns `priceLine`
 * ("3 beds x Rs 799 x 2 nights") with a bed-multiplied `baseAmount`; the widget must print that line
 * (not a misleading per-night average), and its rows must still sum to the Total. A non-dorm quote
 * (no `priceLine`) keeps the unchanged "₹X × N nights" line.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, nextFriday } from 'date-fns';
import { toISODate } from '@/utils/dateRange';
import { getIstStartOfDay } from '@/utils/date';
import type { GuestPriceBreakdown } from '@/api/pricingClient';
import { settle } from '../../test/settle';

const mocks = vi.hoisted(() => ({
  fetchCalendarPricing: vi.fn(),
  fetchGuestPriceBreakdown: vi.fn(),
  booking: { checkIn: null as string | null, checkOut: null as string | null, guests: 2 },
  // TASK-10298998: switchable so the same widget can be measured on an ONLINE host and a WhatsApp hand-off host.
  tenant: {
    slug: 'atlas',
    name: 'Atlastays',
    paymentProvider: 'RAZORPAY' as string | null,
    bookingMode: 'ONLINE' as 'ONLINE' | 'WHATSAPP',
  },
  sticky: { totalAmount: null as number | null },
}));

vi.mock('@/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasRuntimeConfig: () => true,
}));
// An ONLINE Razorpay tenant, so `hasOnlinePaymentRail()` is true and the processing-fee row
// renders — the branch where the Total prefers the server `finalAmount`.
vi.mock('@/tenant/tenantContext', () => ({
  getTenantContext: () => ({ ...mocks.tenant }),
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



async function renderQuote(quote: GuestPriceBreakdown, calendarPerNight: number, nights: number) {
  const checkIn = getIstStartOfDay(nextFriday(addDays(new Date(), 7)));
  const checkOut = addDays(checkIn, nights);
  mocks.booking.checkIn = toISODate(checkIn);
  mocks.booking.checkOut = toISODate(checkOut);
  const dateToPrice = new Map<string, number>();
  for (let i = 0; i < nights; i += 1) dateToPrice.set(toISODate(addDays(checkIn, i)), calendarPerNight);
  mocks.fetchCalendarPricing.mockResolvedValue({ dateToPrice, convenienceFeePercent: 3 });
  mocks.fetchGuestPriceBreakdown.mockResolvedValue(quote);

  const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
  await act(async () => {
    render(
      <MemoryRouter>
        <UnitBookingWidget
          listingId={7}
          propertyId={3}
          listingName="8-Bed Dorm"
          propertySlug="hostel"
          unitSlug="dorm"
          onStickySummaryChange={(summary: { totalAmount: number | null }) => {
            mocks.sticky.totalAmount = summary.totalAmount;
          }}
        />
      </MemoryRouter>,
    );
  });
  await settle();
  const totalRow = screen.getByText('Total').closest('.lv-price-row') as HTMLElement;
  await settle();
  const rows = totalRow.parentElement as HTMLElement;
  const itemRows = Array.from(rows.querySelectorAll<HTMLElement>('.lv-price-row')).filter(
    (r) => !r.classList.contains('lv-total'),
  );
  return {
    total: money(totalRow.querySelector('.lv-num')?.textContent),
    lineTotal: itemRows.reduce((sum, r) => sum + money(r.querySelector('.lv-num')?.textContent), 0),
    baseLabel: rows.querySelector('[data-testid="price-line-base"] > span:first-child')?.textContent ?? '',
    baseAmount: money(rows.querySelector('[data-testid="price-line-base"] .lv-num')?.textContent),
  };
}

const baseQuote: GuestPriceBreakdown = {
  baseAmount: 4794,
  discountAmount: 0,
  losDiscountAmount: 0,
  lastMinuteDiscountAmount: 0,
  repeatGuestDiscountAmount: 0,
  longStayDiscountAmount: 0,
  convenienceFeeAmount: 144,
  convenienceFeePercent: 3,
  touristTaxAmount: 0,
  gstPercent: 0,
  gstAmount: 0,
  finalAmount: 4938,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  mocks.booking.checkIn = null;
  mocks.booking.checkOut = null;
  mocks.sticky.totalAmount = null;
});

describe('UnitBookingWidget — HSL-010 dorm price line', () => {
  it('prints the server bed line and the rows still sum to the Total', async () => {
    const r = await renderQuote({ ...baseQuote, priceLine: '3 beds x Rs 799 x 2 nights' }, 799, 2);

    expect(r.baseLabel).toBe('3 beds x Rs 799 x 2 nights');
    expect(r.baseAmount).toBe(4794);
    expect(r.lineTotal).toBe(r.total);
    expect(r.total).toBe(4938);
  });

  it('control: a quote without priceLine keeps the per-night line', async () => {
    const r = await renderQuote({ ...baseQuote, baseAmount: 1598, convenienceFeeAmount: 48, finalAmount: 1646 }, 799, 2);

    expect(r.baseLabel).toContain('×');
    expect(r.baseLabel).toContain('2 nights');
    expect(r.baseLabel).not.toContain('beds');
    expect(r.baseAmount).toBe(1598);
  });
});
