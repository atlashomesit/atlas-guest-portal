/**
 * HSL-011 - the booking widget on a HostelDorm sells BEDS:
 *   - the guest card says "Beds" (never "Guests"), counts beds, and the badge shows the API's gender rule;
 *   - it prints the live "X of Y beds left" (smallest free count across the chosen nights / the dorm's bed count);
 *   - it prints the all-in total per bed under the Total;
 *   - Reserve hands the API's gender policy to checkout (BookingContext.holdDormGenderPolicy);
 *   - a non-dorm listing keeps "Guests" and shows none of this.
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
  fetchAvailabilityRatesForMonths: vi.fn(),
  updateBooking: vi.fn(),
  booking: { checkIn: null as string | null, checkOut: null as string | null, guests: 3 },
  tenant: { slug: 'atlas', name: 'Atlastays', paymentProvider: 'RAZORPAY', bookingMode: 'ONLINE' },
}));

vi.mock('@/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasRuntimeConfig: () => true,
}));
vi.mock('@/tenant/tenantContext', () => ({ getTenantContext: () => ({ ...mocks.tenant }) }));
vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `http://localhost:5120${path}`,
  getApiHeaders: () => ({}),
  getOrderRequestHeaders: () => ({}),
}));
vi.mock('@/api/availabilityCalendarClient', () => ({
  dedupedAvailabilityCalendarFetch: async () =>
    new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }),
}));
vi.mock('@/api/availabilityRatesClient', () => ({
  fetchAvailabilityRatesForMonths: mocks.fetchAvailabilityRatesForMonths,
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
  useBooking: () => ({ booking: mocks.booking, updateBooking: mocks.updateBooking }),
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

const quote: GuestPriceBreakdown = {
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
  priceLine: '3 beds x Rs 799 x 2 nights',
};

type DormProps = {
  accommodationType?: string | null;
  dormGenderPolicy?: 'FemaleOnly' | 'MaleOnly' | 'Mixed' | null;
  dormBedCount?: number | null;
};

/** `freePerNight[i]` = beds free on night i of the stay; later nights are wide open. */
async function renderWidget(props: DormProps, freePerNight: number[], nights = 2, covered = true) {
  const checkIn = getIstStartOfDay(nextFriday(addDays(new Date(), 7)));
  const checkOut = addDays(checkIn, nights);
  mocks.booking.checkIn = toISODate(checkIn);
  mocks.booking.checkOut = toISODate(checkOut);
  const dateToPrice = new Map<string, number>();
  const days: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 8; i += 1) {
    const iso = toISODate(addDays(checkIn, i));
    if (i < nights) dateToPrice.set(iso, 799);
    days.push({
      date: iso, nightlyRate: 799, roomsAvailable: freePerNight[i] ?? 8, isAvailable: true,
      bookable: true, reason: null, priceSource: null,
    });
  }
  mocks.fetchCalendarPricing.mockResolvedValue({ dateToPrice, convenienceFeePercent: 3 });
  mocks.fetchGuestPriceBreakdown.mockResolvedValue(quote);
  mocks.fetchAvailabilityRatesForMonths.mockResolvedValue(covered ? days : []);

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
          maxGuests={8}
          {...props}
        />
      </MemoryRouter>,
    );
  });
  await settle();
  await settle();
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  mocks.booking.checkIn = null;
  mocks.booking.checkOut = null;
  mocks.booking.guests = 3;
});

const DORM: DormProps = { accommodationType: 'HostelDorm', dormGenderPolicy: 'FemaleOnly', dormBedCount: 8 };

describe('UnitBookingWidget - HSL-011 dorm sells beds', () => {
  it('says Beds (not Guests) and counts beds', async () => {
    await renderWidget(DORM, [5, 3]);
    const trigger = screen.getByRole('button', { name: /^Beds: 3 beds\./ });
    expect(trigger).toHaveTextContent('Beds');
    expect(trigger).toHaveTextContent('3 beds');
    expect(trigger).not.toHaveTextContent(/guests|adults/i);
  });

  it('prints the live "3 of 8 beds left": the smallest free count across the chosen nights, over the dorm\'s bed count', async () => {
    await renderWidget(DORM, [5, 3]);
    expect(screen.getByTestId('dorm-beds-left')).toHaveTextContent('3 of 8 beds left');
  });

  it('prints the all-in total per bed under the Total', async () => {
    await renderWidget(DORM, [5, 3]);
    // 4,938 all-in for 3 beds = 1,646 a bed.
    expect(screen.getByTestId('dorm-per-bed-total')).toHaveTextContent(/About .*1,?646 per bed, all in/);
  });

  it('shows the API gender rule on the badge', async () => {
    await renderWidget(DORM, [5, 3]);
    expect(screen.getByTestId('hostel-dorm-base-badge')).toBeInTheDocument();
    expect(screen.getByTestId('hostel-gender-badge-female')).toBeInTheDocument();
  });

  it('with fewer beds free than asked it says so and Reserve does not move on to checkout', async () => {
    mocks.booking.guests = 4;
    await renderWidget(DORM, [5, 3]);
    expect(screen.getByTestId('dorm-over-beds')).toHaveTextContent('Only 3 beds left on these dates');

    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();
    expect(mocks.updateBooking).not.toHaveBeenCalled();
  });

  it('Reserve hands the dorm\'s gender policy to checkout', async () => {
    await renderWidget(DORM, [5, 3]);
    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();
    expect(mocks.updateBooking).toHaveBeenCalledWith(expect.objectContaining({ holdDormGenderPolicy: 'FemaleOnly', guests: 3 }));
  });

  it('shows no "left" line when the availability data does not cover the nights (never a guess)', async () => {
    await renderWidget(DORM, [5, 3], 2, false);
    expect(screen.queryByTestId('dorm-beds-left')).toBeNull();
  });

  it('control: a non-dorm listing keeps "Guests" and shows no bed lines, badge or per-bed total', async () => {
    mocks.booking.guests = 2;
    await renderWidget({ accommodationType: 'Hotel' }, [5, 3]);
    const trigger = screen.getByRole('button', { name: /^Guests: 2 guests\./ });
    expect(trigger).toHaveTextContent('Guests');
    expect(screen.queryByTestId('dorm-beds-left')).toBeNull();
    expect(screen.queryByTestId('dorm-per-bed-total')).toBeNull();
    expect(screen.queryByTestId('hostel-dorm-container')).toBeNull();
  });

  it('control: a dorm-named listing with no API dorm type is NOT a dorm (the name is never read)', async () => {
    mocks.booking.guests = 2;
    await renderWidget({}, [5, 3]);
    expect(screen.getByRole('button', { name: /^Guests: 2 guests\./ })).toBeInTheDocument();
    expect(screen.queryByTestId('hostel-dorm-container')).toBeNull();
  });
});
