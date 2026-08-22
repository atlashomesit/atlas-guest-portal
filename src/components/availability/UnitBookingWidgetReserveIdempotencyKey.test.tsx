import { afterEach, describe, it, expect, vi } from 'vitest';
import axios, { AxiosError } from 'axios';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, nextFriday } from 'date-fns';
import { toISODate } from '@/utils/dateRange';
import { getIstStartOfDay } from '@/utils/date';

// TASK-8218 proving test: handleReserve must hold its Idempotency-Key steady across a retry of
// the SAME (listingId, checkIn, checkOut, guests) attempt, and must mint a NEW key the moment any
// of those inputs change — a key that never rotates would dedupe a genuinely new booking attempt
// against an old hold, which is just as wrong as one that rotates on every click.

const navigateSpy = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

const ctx = vi.hoisted(() => ({
  fetchCalendarPricing: vi.fn(),
  fetchGuestGstBreakdown: vi.fn(),
  booking: { checkIn: null as string | null, checkOut: null as string | null, guests: 2 },
  updateBooking: vi.fn(),
}));

const availabilityOk = () =>
  new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
const availabilityMock = vi.hoisted(() => ({ fetch: vi.fn() }));
availabilityMock.fetch.mockImplementation(availabilityOk);

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
// Real getOrderRequestHeaders shape (Idempotency-Key: <key>) without the real module's tenant
// resolution — that's what lets this test read the key straight off the axios.post call.
vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `http://localhost:5120${path}`,
  getApiHeaders: () => ({}),
  getOrderRequestHeaders: (idempotencyKey: string) => ({ 'Idempotency-Key': idempotencyKey }),
}));
vi.mock('@/api/availabilityCalendarClient', () => ({
  dedupedAvailabilityCalendarFetch: (...args: unknown[]) => availabilityMock.fetch(...args),
}));
vi.mock('@/api/pricingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchCalendarPricing: ctx.fetchCalendarPricing,
  fetchGuestGstBreakdown: ctx.fetchGuestGstBreakdown,
}));
vi.mock('@/api/listingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchPublicListings: async () => [],
}));
vi.mock('@/contexts/BookingContext', () => ({
  useBooking: () => ({ booking: ctx.booking, updateBooking: ctx.updateBooking }),
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

describe('UnitBookingWidget - TASK-8218: Reserve idempotency key is stable across retry, rotates on input change', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    availabilityMock.fetch.mockReset();
    availabilityMock.fetch.mockImplementation(availabilityOk);
    ctx.booking.checkIn = null;
    ctx.booking.checkOut = null;
    ctx.booking.guests = 2;
    navigateSpy.mockReset();
  });

  const renderWidget = async () => {
    const friday = getIstStartOfDay(nextFriday(addDays(new Date(), 14)));
    const sunday = addDays(friday, 2);
    ctx.booking.checkIn = toISODate(friday);
    ctx.booking.checkOut = toISODate(sunday);
    ctx.booking.guests = 2;

    ctx.fetchCalendarPricing.mockResolvedValue({
      dateToPrice: new Map([[toISODate(friday), 5000], [toISODate(addDays(friday, 1)), 5000]]),
      convenienceFeePercent: 3,
    });
    ctx.fetchGuestGstBreakdown.mockResolvedValue({ gstPercent: 5, gstAmount: 500, finalAmount: 10800 });

    const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
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

    const reserve = await screen.findByTestId('guest-booking-submit');
    await waitFor(() => expect(reserve).toBeEnabled());
    return reserve;
  };

  it('reuses the SAME Idempotency-Key on a retry after a lost/timed-out response (same listing/dates/guests)', async () => {
    const timeoutError = new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED');
    const postSpy = vi.spyOn(axios, 'post')
      // First attempt: the server committed the hold but the response never made it back to
      // the client (axios client-side timeout) — exactly the TASK-8218 repro.
      .mockRejectedValueOnce(timeoutError)
      // Retry: server-authoritative hold data comes back this time.
      .mockResolvedValueOnce({
        data: { holdId: 501, holdExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString() },
      });

    const reserve = await renderWidget();

    await act(async () => {
      fireEvent.click(reserve);
    });
    // First call failed; the guest is shown an error and Reserve becomes clickable again.
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('guest-booking-submit')).toBeEnabled());

    await act(async () => {
      fireEvent.click(reserve);
    });
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(2));

    const firstHeaders = postSpy.mock.calls[0][2]?.headers as Record<string, string>;
    const secondHeaders = postSpy.mock.calls[1][2]?.headers as Record<string, string>;
    expect(firstHeaders['Idempotency-Key']).toBeTruthy();
    // The correctness bar: retry of the SAME logical attempt must carry the SAME key, so the
    // server's replay ledger matches it instead of running CreateInitHoldAsync a second time
    // and 409ing against the guest's own just-created hold.
    expect(secondHeaders['Idempotency-Key']).toBe(firstHeaders['Idempotency-Key']);

    // The retry succeeded and the guest proceeded to the details page — never "no longer available".
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/book/atlas501-ph/ph/details'));
    expect(screen.queryByText(/no longer available/i)).toBeNull();
  });

  it('mints a NEW Idempotency-Key once the guest changes guests before retrying (never dedupe a genuinely new attempt)', async () => {
    const timeoutError = new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED');
    const postSpy = vi.spyOn(axios, 'post')
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce({
        data: { holdId: 502, holdExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString() },
      });

    const reserve = await renderWidget();

    await act(async () => {
      fireEvent.click(reserve);
    });
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('guest-booking-submit')).toBeEnabled());

    // Guest bumps the guest count before retrying — this is a genuinely different booking
    // attempt and must never be deduped against the failed one's key.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Guests: 2 guests/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Increase guests' }));
    });

    await act(async () => {
      fireEvent.click(reserve);
    });
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(2));

    const firstHeaders = postSpy.mock.calls[0][2]?.headers as Record<string, string>;
    const secondHeaders = postSpy.mock.calls[1][2]?.headers as Record<string, string>;
    expect(secondHeaders['Idempotency-Key']).toBeTruthy();
    expect(secondHeaders['Idempotency-Key']).not.toBe(firstHeaders['Idempotency-Key']);
    // The second request actually carries the new guest count (3), proving this is a real new
    // attempt and not merely a re-keyed replay of the old one.
    expect(postSpy.mock.calls[1][1]).toMatchObject({ bookingDraft: { guests: 3 } });
  });
});
