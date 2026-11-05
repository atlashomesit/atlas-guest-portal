import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, nextFriday } from 'date-fns';
import { toISODate } from '@/utils/dateRange';
import { getIstStartOfDay } from '@/utils/date';
import { clearAgentCode } from '@/lib/agentCode';
import type { BookingStickySummary } from './UnitBookingWidget';
import { settle } from '../../test/settle';

const mocks = vi.hoisted(() => ({
  fetchCalendarPricing: vi.fn(),
  fetchGuestGstBreakdown: vi.fn(),
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
// The REAL fetchPublicListingRatePlans runs (it reads the remembered code); everything else the widget fetches is mocked.
vi.mock('@/api/pricingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchCalendarPricing: mocks.fetchCalendarPricing,
  fetchGuestGstBreakdown: mocks.fetchGuestGstBreakdown,
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


/**
 * GUEST-059 / GUEST-060 through the real widget: the selected rate plan's own cancellation wording reaches the
 * listing page (via the sticky summary the page already receives), a guest count above the home's maximum is
 * explained instead of silently dropped, and the included-guests line renders from the listing's own numbers.
 */
const plan = (extra: Record<string, unknown>) => ({
  listingId: 7, sortOrder: 0, guests: 2, isDefault: false,
  baseNightlyRate: 6000, effectiveNightlyRate: 6000, totalStayAmount: 12000,
  cancellationPolicy: 'Flexible', cancellationSummary: 'Free cancellation up to 7 days before check-in',
  mealPlanCode: 'EP', mealPlanLabel: 'Room Only', isDerived: false, ...extra,
});

function stubPlansEndpoint(body: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
    const url = String(input);
    return new Response(JSON.stringify(url.includes('/rate-plans/public') ? body : []), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }));
}

async function renderWidget(props: Record<string, unknown> = {}) {
  const checkIn = getIstStartOfDay(nextFriday(addDays(new Date(), 7)));
  mocks.fetchCalendarPricing.mockResolvedValue({ dateToPrice: new Map<string, number>(), convenienceFeePercent: 0 });
  mocks.fetchGuestGstBreakdown.mockResolvedValue(null);
  mocks.fetchGuestPriceBreakdown.mockResolvedValue(null);
  mocks.booking.checkIn = toISODate(checkIn);
  mocks.booking.checkOut = toISODate(addDays(checkIn, 2));
  const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
  const summaries: BookingStickySummary[] = [];
  await act(async () => {
    render(
      <MemoryRouter>
        <UnitBookingWidget
          listingId={7}
          propertyId={3}
          listingName="Villa"
          propertySlug="villa"
          unitSlug="u1"
          onStickySummaryChange={(s: BookingStickySummary) => summaries.push(s)}
          {...props}
        />
      </MemoryRouter>,
    );
  });
  await settle();
  return summaries;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearAgentCode();
  mocks.booking.guests = 2;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearAgentCode();
  mocks.booking.checkIn = null;
  mocks.booking.checkOut = null;
  mocks.booking.guests = 2;
});

describe('UnitBookingWidget - GUEST-059: the selected rate plan speaks for the listing page', () => {
  it('hands the page the non-refundable wording when the selected plan is non-refundable', async () => {
    stubPlansEndpoint([
      plan({ id: 21, name: 'Saver', isDefault: true, cancellationPolicy: 'NonRefundable', cancellationSummary: 'Non-refundable, lowest price' }),
    ]);
    const summaries = await renderWidget();
    const last = summaries[summaries.length - 1];
    expect(last.ratePlanCancellation).toEqual({ headline: 'Non-refundable, lowest price', nonRefundable: true });
  });

  it('hands the page the plans own days, not the generic full-refund line, for a flexible plan', async () => {
    stubPlansEndpoint([plan({ id: 22, name: 'Standard', isDefault: true })]);
    const summaries = await renderWidget();
    const last = summaries[summaries.length - 1];
    expect(last.ratePlanCancellation).toEqual({ headline: 'Free cancellation up to 7 days before check-in', nonRefundable: false });
  });
});

describe('UnitBookingWidget - GUEST-060: guest count above the maximum, and what the price includes', () => {
  it('explains a guest count above the maximum and keeps the most the home allows', async () => {
    stubPlansEndpoint([plan({ id: 23, name: 'Standard', isDefault: true })]);
    mocks.booking.guests = 4;
    await renderWidget({ maxGuests: 3 });
    expect(screen.getByTestId('bw-guests-over-limit').textContent).toMatch(/You asked for 4 guests, but this home allows up to 3\. We've set 3\./);
    expect(screen.getByText('3 adults')).toBeTruthy();
  });

  it('shows no over-limit message when the count fits', async () => {
    stubPlansEndpoint([plan({ id: 24, name: 'Standard', isDefault: true })]);
    mocks.booking.guests = 3;
    await renderWidget({ maxGuests: 3 });
    expect(screen.queryByTestId('bw-guests-over-limit')).toBeNull();
  });

  it('shows what the price includes from the listings own numbers, for two different hosts', async () => {
    stubPlansEndpoint([plan({ id: 25, name: 'Standard', isDefault: true })]);
    await renderWidget({ maxGuests: 8, includedGuests: 2, extraGuestRate: 500 });
    expect(screen.getByTestId('bw-included-guests').textContent).toMatch(/Includes 2 guests, then .*500.* per extra guest per night/);
    cleanup();
    await renderWidget({ maxGuests: 6, includedGuests: 4, extraGuestRate: null });
    expect(screen.getByTestId('bw-included-guests').textContent).toBe('Includes 4 guests');
  });

  it('WALK2-2: rows that are not one plain amount say the price changes with the guests, with no number', async () => {
    stubPlansEndpoint([plan({ id: 27, name: 'Standard', isDefault: true })]);
    await renderWidget({ maxGuests: 4, includedGuests: 2, extraGuestRate: null, priceChangesWithGuests: true });
    expect(screen.getByTestId('bw-included-guests').textContent).toBe('Includes 2 guests. Price changes with the number of guests');
  });

  it('shows nothing when the listing sends no included-guest count', async () => {
    stubPlansEndpoint([plan({ id: 26, name: 'Standard', isDefault: true })]);
    await renderWidget({ maxGuests: 8 });
    expect(screen.queryByTestId('bw-included-guests')).toBeNull();
  });
});
