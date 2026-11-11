import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, format, nextFriday } from 'date-fns';
import { toISODate } from '@/utils/dateRange';
import { getIstStartOfDay } from '@/utils/date';
import { settle } from '../../test/settle';

// FOUNDER RULED 2026-10-19 (website booking overhaul). Reserve no longer calls POST /api/Razorpay/order at all: the 10-minute
// hold starts at Pay on the details page. A host the API reports as bookingMode "WHATSAPP" (no usable payment provider) is
// handed to its WhatsApp straight from Reserve, BEFORE any network call (TASK-8048 fail-closed; the 2026-10-19 07:16 UTC guest of
// a host with no provider reached the order endpoint). The contract on TenantInfo.bookingMode: "hand off to host's WhatsApp with
// prefilled booking details"; the guest's dates stay on screen and no raw server text is ever printed.

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
  trackEvent: vi.fn(),
  // The AMBIENT tenant (what getTenantContext() resolves for the site the guest is on).
  tenant: {
    slug: 'staybycf',
    name: 'Stay By CF',
    paymentProvider: undefined as string | undefined,
    bookingMode: 'WHATSAPP' as 'ONLINE' | 'MANUAL' | 'WHATSAPP' | undefined,
    whatsappBookingPhone: '919876543210' as string | undefined,
  },
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
  getTenantContext: () => ctx.tenant,
}));
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
vi.mock('@/utils/analytics', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  trackEvent: (...args: unknown[]) => ctx.trackEvent(...args),
}));
vi.mock('./AtlasBookingCalendar', () => ({ AtlasBookingCalendar: () => null }));

const GENERIC_CHECKOUT_ERROR = "We couldn't start checkout";

const friday = getIstStartOfDay(nextFriday(addDays(new Date(), 14)));
const sunday = addDays(friday, 2);

async function renderWidget(props: Record<string, unknown> = {}) {
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
        {...props}
      />
    </MemoryRouter>,
  );
  await settle();
  const reserve = screen.getByTestId('guest-booking-submit');
  await settle();
  expect(reserve).toBeEnabled();
  return reserve;
}

const clickReserve = async (reserve: HTMLElement) => {
  await act(async () => {
    fireEvent.click(reserve);
  });
  await settle();
};

describe('UnitBookingWidget - Reserve hands a host with no online payment to WhatsApp BEFORE any network call (2026-10-19)', () => {
  beforeEach(() => {
    ctx.tenant.slug = 'staybycf';
    ctx.tenant.name = 'Stay By CF';
    ctx.tenant.paymentProvider = undefined;
    ctx.tenant.bookingMode = 'WHATSAPP';
    ctx.tenant.whatsappBookingPhone = '919876543210';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    availabilityMock.fetch.mockReset();
    availabilityMock.fetch.mockImplementation(availabilityOk);
    ctx.booking.checkIn = null;
    ctx.booking.checkOut = null;
    ctx.booking.guests = 2;
    navigateSpy.mockReset();
  });

  it('a WHATSAPP host shows the hand-off with a pre-filled booking request and never reaches POST /api/Razorpay/order', async () => {
    const postSpy = vi.spyOn(axios, 'post');
    const reserve = await renderWidget();

    await clickReserve(reserve);

    // Fail closed (TASK-8048): the guest of a host with no payment provider must not reach the order API at all.
    expect(postSpy).not.toHaveBeenCalled();
    const handoff = screen.getByTestId('reserve-whatsapp-handoff');
    expect(handoff).toHaveTextContent('Online payment is not available for this property.');
    expect(handoff).toHaveTextContent('Contact the host on WhatsApp to confirm your dates.');

    const cta = screen.getByTestId('reserve-whatsapp-handoff-cta') as HTMLAnchorElement;
    expect(cta).toHaveTextContent('WhatsApp host to confirm');
    expect(cta.target).toBe('_blank');
    expect(cta.rel).toContain('noopener');

    // wa.me/<host digits>?text=<booking request with the dates + guests the guest already picked>.
    const url = new URL(cta.href);
    expect(url.origin + url.pathname).toBe('https://wa.me/919876543210');
    const text = url.searchParams.get('text') ?? '';
    expect(text).toContain('Atlas 501 PH');
    expect(text).toContain(format(friday, 'EEE, d MMM yyyy'));
    expect(text).toContain(format(sunday, 'EEE, d MMM yyyy'));
    expect(text).toContain('2 nights');
    expect(text).toContain('2 guests');

    expect(screen.queryByText(new RegExp(GENERIC_CHECKOUT_ERROR))).toBeNull();
    // No hold exists, so nothing is stored in the booking context and the guest is not sent anywhere.
    expect(ctx.updateBooking).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('an ONLINE host: Reserve makes NO network call, starts NO hold and hands the stay to the details page (the hold starts at Pay)', async () => {
    ctx.tenant.bookingMode = 'ONLINE';
    ctx.tenant.paymentProvider = 'RAZORPAY';
    const postSpy = vi.spyOn(axios, 'post');
    const reserve = await renderWidget();

    await clickReserve(reserve);

    // FOUNDER RULED 2026-10-19: details and house rules carry no clock and close no OTA night.
    expect(postSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reserve-whatsapp-handoff')).toBeNull();
    expect(ctx.updateBooking).toHaveBeenCalledTimes(1);
    const draft = ctx.updateBooking.mock.calls[0][0] as Record<string, unknown>;
    expect(draft).toMatchObject({
      holdId: null,
      holdToken: null,
      holdExpiresAt: null,
      holdListingId: 7,
      holdListingName: 'Atlas 501 PH',
      guests: 2,
    });
    expect(draft.checkIn).toEqual(expect.any(String));
    expect(draft.checkOut).toEqual(expect.any(String));
    expect(navigateSpy).toHaveBeenCalledWith('/book/atlas501-ph/ph/details');
  });

  it("keeps the guest's dates and guest count: the form stays mounted, and once the host can take payment the next Reserve proceeds", async () => {
    const postSpy = vi.spyOn(axios, 'post');
    const reserve = await renderWidget();

    await clickReserve(reserve);
    screen.getByTestId('reserve-whatsapp-handoff');

    // Nothing was reset: both date cells still show the picked dates and Reserve is still clickable.
    expect(screen.getByTestId('unit-booking-checkout-cell')).not.toHaveTextContent('Add date');
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();

    // The host connects a payment provider; the next Reserve click succeeds and the stale hand-off is gone.
    ctx.tenant.bookingMode = 'ONLINE';
    await clickReserve(screen.getByTestId('guest-booking-submit'));
    expect(postSpy).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith('/book/atlas501-ph/ph/details');
    expect(screen.queryByTestId('reserve-whatsapp-handoff')).toBeNull();
  });

  it('with no host WhatsApp number it shows the message only - never a recipient-less wa.me link', async () => {
    ctx.tenant.bookingMode = 'WHATSAPP';
    ctx.tenant.whatsappBookingPhone = undefined;
    const postSpy = vi.spyOn(axios, 'post');
    const reserve = await renderWidget();

    await clickReserve(reserve);

    expect(postSpy).not.toHaveBeenCalled();
    const handoff = screen.getByTestId('reserve-whatsapp-handoff');
    expect(handoff).toHaveTextContent('Online payment is not available for this property.');
    expect(handoff).toHaveTextContent('Please contact the host directly to make a reservation.');
    expect(screen.queryByTestId('reserve-whatsapp-handoff-cta')).toBeNull();
    expect(document.querySelector('a[href*="wa.me"]')).toBeNull();
  });

  it("uses the LISTING host's number from the tenantContext prop (marketplace), never the ambient tenant's", async () => {
    // Ambient tenant = the marketplace root with its own number and an online rail; the listing belongs to another host with no provider.
    ctx.tenant.slug = 'marketplace';
    ctx.tenant.bookingMode = 'ONLINE';
    ctx.tenant.whatsappBookingPhone = '917032493290';
    const postSpy = vi.spyOn(axios, 'post');
    const reserve = await renderWidget({
      tenantContext: { slug: 'coorgstay', name: 'Coorg Stay', bookingMode: 'WHATSAPP', whatsappBookingPhone: '919123456789' },
    });

    await clickReserve(reserve);

    // The marketplace guest of a host with NO payment provider never reaches POST /api/Razorpay/order.
    expect(postSpy).not.toHaveBeenCalled();
    const cta = screen.getByTestId('reserve-whatsapp-handoff-cta') as HTMLAnchorElement;
    expect(new URL(cta.href).pathname).toBe('/919123456789');
    expect(cta.href).not.toContain('917032493290');
  });

  it('tapping the hand-off CTA fires the existing whatsapp_cta_click analytics event', async () => {
    const reserve = await renderWidget();
    await clickReserve(reserve);

    ctx.trackEvent.mockClear();
    const cta = screen.getByTestId('reserve-whatsapp-handoff-cta');
    // jsdom does not navigate on anchor clicks; preventDefault keeps the test output clean.
    cta.addEventListener('click', (e) => e.preventDefault());
    await act(async () => {
      fireEvent.click(cta);
    });

    expect(ctx.trackEvent).toHaveBeenCalledWith(
      'whatsapp_cta_click',
      expect.objectContaining({ surface: 'reserve_handoff', listingId: 7 }),
    );
  });
});
