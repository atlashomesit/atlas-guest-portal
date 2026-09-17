import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addMonths, format, startOfMonth } from 'date-fns';

/**
 * TASK-102023: Two pricing fetches race over failure flag.
 *
 * When the guest selects a date range in a different month, both the shown-month fetch
 * and the selected-range fetch run. If the selected-range fetch fails, but the shown-month
 * fetch resolves after it and succeeds, the widget must NOT clear the pricing error flag.
 * The widget must indicate pricing failure (showing 'Couldn't load prices' / bw-pricing-error),
 * keep Reserve disabled, and not revert to the loading skeleton.
 */

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

describe('UnitBookingWidget - TASK-102023: split pricing failure state', () => {
  const FIXED_NOW = new Date('2026-02-15T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    mocks.fetchGuestPriceBreakdown.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
    mocks.booking.checkIn = null;
    mocks.booking.checkOut = null;
  });

  it('keeps pricing failure error when selected-range fetch fails and shown-month fetch succeeds after it', async () => {
    // Current month is 2026-02-01.
    // Selected range is 4 months ahead: 2026-06-10 to 2026-06-15.
    const currentMonthIso = format(startOfMonth(FIXED_NOW), 'yyyy-MM-dd'); // '2026-02-01'
    const futureDate = addMonths(FIXED_NOW, 4);
    const futureMonthIso = format(startOfMonth(futureDate), 'yyyy-MM-dd'); // '2026-06-01'

    mocks.booking.checkIn = '2026-06-10';
    mocks.booking.checkOut = '2026-06-15';

    let resolveShownMonth: (val: unknown) => void = () => {};
    const shownMonthPromise = new Promise((resolve) => {
      resolveShownMonth = resolve;
    });

    mocks.fetchCalendarPricing.mockImplementation((_listingId: number, monthIso: string) => {
      if (monthIso === futureMonthIso) {
        // Selected-range fetch fails immediately with network error
        return Promise.reject(new Error('Network error on selected range'));
      }
      if (monthIso === currentMonthIso) {
        // Shown-month fetch resolves later
        return shownMonthPromise;
      }
      return Promise.resolve({ dateToPrice: new Map(), convenienceFeePercent: 3 });
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

    // Wait for the selected range rejection to take effect
    await waitFor(() => {
      expect(screen.getByTestId('bw-pricing-error')).toBeInTheDocument();
    });

    // Now resolve the shown-month fetch successfully
    await act(async () => {
      resolveShownMonth({ dateToPrice: new Map(), convenienceFeePercent: 3 });
    });

    // The shown-month resolution must NOT clear the failure state for the selected range!
    // bw-pricing-error ("Couldn't load prices") should still be displayed
    expect(screen.getByTestId('bw-pricing-error')).toBeInTheDocument();
    expect(screen.getByText("Couldn't load prices")).toBeInTheDocument();

    // The reserve button must remain disabled
    const reserveButton = screen.getByTestId('guest-booking-submit');
    expect(reserveButton).toBeDisabled();

    // It must not revert to the loading skeleton
    expect(screen.queryByTestId('bw-price-pending')).toBeNull();
  });
});
