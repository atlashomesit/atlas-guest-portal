/**
 * GUEST-048 leftovers (phone walk-through 27 Oct):
 *  (a) the booking box listed nightly rows from the CALENDAR endpoint (pre-adjustment, e.g. 3,150) above a subtotal from the
 *      checkout QUOTE (2,882 a night) - rows that did not add up. When the quote is in and the rows disagree with it, the box
 *      now shows the quote's own single line (the price actually charged); rows still show when they add up.
 *  (b) the cover preview above the date fields painted OptimizedImage's empty pink placeholder; it now paints nothing until
 *      the picture has loaded, and nothing at all when it fails.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
}));

vi.mock('@/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasRuntimeConfig: () => true,
}));
vi.mock('@/tenant/tenantContext', () => ({
  getTenantContext: () => ({ slug: 'atlas', name: 'Atlastays', paymentProvider: 'RAZORPAY', bookingMode: 'ONLINE' }),
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

const money = (text: string | null | undefined): number => Number((text ?? '').replace(/[^0-9]/g, ''));

const quote = (baseAmount: number): GuestPriceBreakdown => ({
  baseAmount,
  discountAmount: 0,
  losDiscountAmount: 0,
  lastMinuteDiscountAmount: 0,
  repeatGuestDiscountAmount: 0,
  longStayDiscountAmount: 0,
  convenienceFeeAmount: 0,
  touristTaxAmount: 0,
  gstPercent: 0,
  gstAmount: 0,
  finalAmount: baseAmount,
  convenienceFeePercent: 0,
}) as GuestPriceBreakdown;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  mocks.booking.checkIn = null;
  mocks.booking.checkOut = null;
});

async function renderStay(calendarNights: [number, number], quoteBase: number) {
  const checkIn = getIstStartOfDay(nextFriday(addDays(new Date(), 7)));
  const dateToPrice = new Map<string, number>();
  dateToPrice.set(toISODate(checkIn), calendarNights[0]);
  dateToPrice.set(toISODate(addDays(checkIn, 1)), calendarNights[1]);
  mocks.fetchCalendarPricing.mockResolvedValue({ dateToPrice, convenienceFeePercent: 0 });
  mocks.fetchGuestPriceBreakdown.mockResolvedValue(quote(quoteBase));
  mocks.booking.checkIn = toISODate(checkIn);
  mocks.booking.checkOut = toISODate(addDays(checkIn, 2));
  const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
  await act(async () => {
    render(
      <MemoryRouter>
        <UnitBookingWidget listingId={7} propertyId={3} listingName="Atlas 302" propertySlug="atlas302" unitSlug="u302" />
      </MemoryRouter>,
    );
  });
  await settle();
}

describe('UnitBookingWidget - GUEST-048 (a): nightly rows must add up to the charged subtotal', () => {
  it('quote lower than the calendar rows: no per-night rows, one line that matches the quote', async () => {
    await renderStay([3150, 3842], 5764);

    expect(screen.queryByTestId('bw-bd-night-row-0')).toBeNull();
    expect(screen.queryByTestId('bw-bd-accommodation-subtotal')).toBeNull();
    expect(money(screen.getByTestId('price-line-base').querySelector('.lv-num')?.textContent)).toBe(5764);
    expect(document.body.textContent).not.toContain('3,842');
  });

  it('quote equal to the calendar rows: the per-night rows still show and add up to the subtotal', async () => {
    await renderStay([3150, 3842], 6992);

    expect(money(screen.getByTestId('bw-bd-night-row-0').querySelector('.lv-num')?.textContent)).toBe(3150);
    expect(money(screen.getByTestId('bw-bd-night-row-1').querySelector('.lv-num')?.textContent)).toBe(3842);
    expect(money(screen.getByTestId('bw-bd-accommodation-subtotal').querySelector('.lv-num')?.textContent)).toBe(6992);
  });
});

describe('BookingCoverPreview - GUEST-048 (b): no empty pink block above the dates', () => {
  it('paints nothing until the picture loads, shows it once loaded', async () => {
    const { BookingCoverPreview } = await import('./UnitBookingWidget');
    render(<BookingCoverPreview src="https://atlashomestorage.blob.core.windows.net/media/a.jpg" alt="Cover" />);
    const box = screen.getByTestId('bw-cover-preview');
    expect(box.style.display).toBe('none');
    await act(async () => { fireEvent.load(box.querySelector('img') as HTMLImageElement); });
    expect(screen.getByTestId('bw-cover-preview').style.display).toBe('');
  });

  it('renders nothing at all when the picture fails (no placeholder box)', async () => {
    const { BookingCoverPreview } = await import('./UnitBookingWidget');
    render(<BookingCoverPreview src="https://atlashomestorage.blob.core.windows.net/media/a.jpg" alt="Cover" />);
    await act(async () => { fireEvent.error(screen.getByTestId('bw-cover-preview').querySelector('img') as HTMLImageElement); });
    expect(screen.queryByTestId('bw-cover-preview')).toBeNull();
  });
});