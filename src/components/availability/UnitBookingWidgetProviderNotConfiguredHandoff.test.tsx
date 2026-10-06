import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import axios, { AxiosError } from 'axios';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, format, nextFriday } from 'date-fns';
import { toISODate } from '@/utils/dateRange';
import { getIstStartOfDay } from '@/utils/date';
import { settle } from '../../test/settle';

// No-task fix (found 2026-10-06 by p0d-20261006b). Since TASK-101182 the Reserve step's init-hold call
// (POST /api/Razorpay/order, bookingDraft only) fails closed with 422 PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT
// for a tenant with no usable payment provider — exactly the tenants the API reports as
// bookingMode "WHATSAPP". Before the fix the widget answered that 422 with the GENERIC "We couldn't start
// checkout…" line and a dead end. It must instead hand the guest to the host's WhatsApp (the contract on
// TenantInfo.bookingMode: "hand off to host's WhatsApp with prefilled booking details"), keep the dates the
// guest already picked, and never print raw server text.

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

// The raw server text that must NEVER reach a guest. `message` is the API's own English sentence and
// `details` carries the internal routing reason + an admin-portal path — both are server text.
const RAW_MESSAGE = 'Online payment is not configured for this property.';
const RAW_DETAILS =
  'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT: Payment provider not configured for this tenant. ' +
  'Missing: [TenantPaymentProvider row missing]. Configure at /settings/payments';
const GENERIC_CHECKOUT_ERROR = "We couldn't start checkout";

/** The exact wire shape RazorpayController.BuildError produces (camelCase JSON). */
function apiError(status: number, code: string, message: string, details = RAW_DETAILS) {
  return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: 'Unprocessable Entity',
    data: {
      code,
      message,
      details,
      recoveryActions: [{ actionType: 'CONTACT_SUPPORT', actionLabel: 'Contact support', actionUrl: '/contact' }],
    },
    headers: {},
    config: {} as never,
  });
}

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

describe('UnitBookingWidget - Reserve 422 PAYMENT_PROVIDER_NOT_CONFIGURED_* hands the guest to the host on WhatsApp', () => {
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

  it.each([
    ['PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT', RAW_MESSAGE],
    ['PAYMENT_PROVIDER_NOT_CONFIGURED', 'Online booking is currently unavailable.'],
  ])('422 %s shows the WhatsApp hand-off with a pre-filled booking request, not the generic checkout error', async (code, message) => {
    const postSpy = vi.spyOn(axios, 'post').mockRejectedValueOnce(apiError(422, code, message));
    const reserve = await renderWidget();

    await clickReserve(reserve);

    expect(postSpy).toHaveBeenCalledTimes(1);
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

    // The generic dead-end copy is gone, and no raw server text is ever shown to the guest.
    expect(screen.queryByText(new RegExp(GENERIC_CHECKOUT_ERROR))).toBeNull();
    const shown = document.body.textContent ?? '';
    expect(shown).not.toContain(message);
    expect(shown).not.toContain('PAYMENT_PROVIDER_NOT_CONFIGURED');
    expect(shown).not.toContain('Configure at');
    expect(shown).not.toContain('/settings/payments');
    expect(shown).not.toContain('TenantPaymentProvider');

    // No hold exists, so nothing is stored in the booking context and the guest is not sent anywhere.
    expect(ctx.updateBooking).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    // The retired full-widget "opening soon" banner (503 PLATFORM only) must not take over the form.
    expect(screen.queryByTestId('provider-blocked-banner')).toBeNull();
  });

  it('keeps the guest\'s dates and guest count: the form stays mounted and a retry re-posts the SAME booking draft', async () => {
    const postSpy = vi.spyOn(axios, 'post')
      .mockRejectedValueOnce(apiError(422, 'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT', RAW_MESSAGE))
      // The host reconnects a payment provider; the next Reserve click succeeds.
      .mockResolvedValueOnce({ data: { holdId: 901, holdExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString() } });
    const reserve = await renderWidget();

    await clickReserve(reserve);
    screen.getByTestId('reserve-whatsapp-handoff');

    // Nothing was reset: both date cells still show the picked dates and Reserve is still clickable.
    expect(screen.getByTestId('unit-booking-checkout-cell')).not.toHaveTextContent('Add date');
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();

    await clickReserve(screen.getByTestId('guest-booking-submit'));
    expect(postSpy).toHaveBeenCalledTimes(2);
    expect(postSpy.mock.calls[1][1]).toEqual(postSpy.mock.calls[0][1]);
    expect(postSpy.mock.calls[0][1]).toMatchObject({
      bookingDraft: { listingId: 7, checkinDate: toISODate(friday), checkoutDate: toISODate(sunday), guests: 2 },
    });

    // The recovered attempt proceeds to the details page and the stale hand-off is gone.
    expect(navigateSpy).toHaveBeenCalledWith('/book/atlas501-ph/ph/details');
    expect(screen.queryByTestId('reserve-whatsapp-handoff')).toBeNull();
  });

  it('with no host WhatsApp number it shows the message only - never a recipient-less wa.me link', async () => {
    ctx.tenant.bookingMode = undefined;
    ctx.tenant.whatsappBookingPhone = undefined;
    vi.spyOn(axios, 'post').mockRejectedValueOnce(apiError(422, 'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT', RAW_MESSAGE));
    const reserve = await renderWidget();

    await clickReserve(reserve);

    const handoff = screen.getByTestId('reserve-whatsapp-handoff');
    expect(handoff).toHaveTextContent('Online payment is not available for this property.');
    expect(handoff).toHaveTextContent('Please contact the host directly to make a reservation.');
    expect(screen.queryByTestId('reserve-whatsapp-handoff-cta')).toBeNull();
    expect(document.querySelector('a[href*="wa.me"]')).toBeNull();
    expect(document.body.textContent ?? '').not.toContain(RAW_MESSAGE);
  });

  it('uses the LISTING host\'s number from the tenantContext prop (marketplace), never the ambient tenant\'s', async () => {
    // Ambient tenant = the marketplace root with its own number; the listing belongs to another host.
    ctx.tenant.slug = 'marketplace';
    ctx.tenant.whatsappBookingPhone = '917032493290';
    vi.spyOn(axios, 'post').mockRejectedValueOnce(apiError(422, 'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT', RAW_MESSAGE));
    const reserve = await renderWidget({
      tenantContext: { slug: 'coorgstay', name: 'Coorg Stay', bookingMode: 'WHATSAPP', whatsappBookingPhone: '919123456789' },
    });

    await clickReserve(reserve);

    const cta = screen.getByTestId('reserve-whatsapp-handoff-cta') as HTMLAnchorElement;
    expect(new URL(cta.href).pathname).toBe('/919123456789');
    expect(cta.href).not.toContain('917032493290');
  });

  it('a non-provider 422 (PAYMENT_VALIDATION_ERROR) keeps the generic error - the match is on the API code, not the bare status', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce(
      apiError(422, 'PAYMENT_VALIDATION_ERROR', 'We could not start payment. Please review your booking details.', 'Listing with ID 7 does not exist'),
    );
    const reserve = await renderWidget();

    await clickReserve(reserve);

    expect(screen.queryByTestId('reserve-whatsapp-handoff')).toBeNull();
    expect(screen.getByText(new RegExp(GENERIC_CHECKOUT_ERROR))).toBeInTheDocument();
  });

  it('503 PAYMENT_PROVIDER_NOT_CONFIGURED_PLATFORM keeps its existing "Bookings opening soon" banner (unchanged)', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce(
      apiError(503, 'PAYMENT_PROVIDER_NOT_CONFIGURED_PLATFORM', 'Payment service is temporarily unavailable.'),
    );
    const reserve = await renderWidget();

    await clickReserve(reserve);

    expect(screen.getByTestId('provider-blocked-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('reserve-whatsapp-handoff')).toBeNull();
  });

  it('tapping the hand-off CTA fires the existing whatsapp_cta_click analytics event', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce(apiError(422, 'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT', RAW_MESSAGE));
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
