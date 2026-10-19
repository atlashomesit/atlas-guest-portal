/**
 * FOUNDER RULED 2026-10-19 (website booking overhaul) - the 10-minute hold, which also closes the night on every OTA, starts when the
 * guest taps PAY, not at Reserve:
 *   - arriving on the details page carries no clock and no hold;
 *   - the host's own house rules are shown with a REQUIRED tick before Pay (only when the host wrote rules);
 *   - Pay re-checks the nights and starts the hold; if the nights are gone the guest is told BEFORE any money moves;
 *   - after the FIRST failed payment: "Payment didn't go through" with [Try again] and [Message the host on WhatsApp] (the HOST's
 *     number, pre-written, never Atlas's), and "Try again" inside the window keeps the SAME hold.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import axios, { AxiosError } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingProvider } from '@/contexts/BookingContext';
import { istInstantFromCalendarDate } from '@/utils/date';
import type { ListingCheckoutInfo } from '@/api/checkoutInfoClient';
import GuestDetailsPage from './GuestDetailsPage';
import { settle } from '../../test/settle';

window.HTMLElement.prototype.scrollIntoView = vi.fn();

const ctx = vi.hoisted(() => ({
  info: null as null | Record<string, unknown>,
  tenant: {
    slug: 'atlas',
    name: 'Atlas Homes',
    paymentProvider: 'RAZORPAY',
    bookingMode: 'ONLINE' as 'ONLINE' | 'WHATSAPP' | undefined,
    // The SITE's own number (Atlas default on a marketplace/apex site) - it must NEVER be used for the failed-payment host message.
    whatsappBookingPhone: '917032493290' as string | undefined,
  },
}));

vi.mock('@/lib/events', () => ({
  track: vi.fn(),
  TerminalCheckoutOutcomeEvents: {
    PaymentModalDismissed: 'payment_modal_dismissed',
    PaymentFailed: 'payment_failed',
    HoldExpiredDuringPayment: 'hold_expired_during_payment',
    ChargedUnconfirmed: 'charged_unconfirmed',
    PaymentConfirmed: 'payment_confirmed',
  },
}));
vi.mock('@/tenant/tenantContext', () => ({ getTenantContext: () => ctx.tenant }));
vi.mock('@/api/checkoutInfoClient', () => ({
  fetchListingCheckoutInfo: vi.fn(async () => ctx.info),
}));

const CHECKOUT_HOLD_KEY = 'atlas_guest_checkout_hold';

const rzp = {
  options: null as null | Record<string, unknown>,
  handlers: {} as Record<string, (r: unknown) => void>,
  opened: 0,
};

function baseInfo(over: Partial<ListingCheckoutInfo> = {}): ListingCheckoutInfo {
  return {
    listingId: 637,
    hostName: 'Grove & Co',
    hasHouseRules: false,
    houseRulesText: null,
    houseRulesPdfUrl: null,
    houseRulesStructuredJson: null,
    hostWhatsAppDigits: '919123456789',
    hostPhoneDigits: '919123456780',
    bookingMode: 'ONLINE',
    onlinePaymentsAvailable: true,
    ...over,
  };
}

function seedDraft() {
  window.sessionStorage.setItem(
    CHECKOUT_HOLD_KEY,
    JSON.stringify({
      savedAt: Date.now(),
      holdListingId: 637,
      holdPropertySlug: 'grove-co',
      holdUnitSlug: 'penthouse',
      holdTenantSlug: 'grove-and-co',
      holdListingName: 'Penthouse',
      holdPriceBreakdown: { baseAmount: 4350, discountAmount: 0, convenienceFeeAmount: 129, finalAmount: 4479, nights: 1, currency: 'INR' },
      checkIn: istInstantFromCalendarDate(new Date(2026, 9, 20)).toISOString(),
      checkOut: istInstantFromCalendarDate(new Date(2026, 9, 21)).toISOString(),
      guests: 2,
    }),
  );
}

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/book/grove-co/penthouse/details?tenant=grove-and-co']}>
      <BookingProvider>
        <GuestDetailsPage />
      </BookingProvider>
    </MemoryRouter>,
  );
  await settle();
  await settle();
}

function fillDetails() {
  fireEvent.change(screen.getByTestId('guest-booking-name'), { target: { value: 'Asha Rao' } });
  fireEvent.change(screen.getByTestId('guest-booking-email'), { target: { value: 'asha@example.com' } });
  fireEvent.change(screen.getByTestId('guest-booking-phone'), { target: { value: '9876543210' } });
}

const FUTURE = () => new Date(Date.now() + 10 * 60_000).toISOString();

/** init-hold (no guestInfo) -> hold; final-charge (guestInfo) -> order. */
function mockOrderApi(post: ReturnType<typeof vi.spyOn>) {
  post.mockImplementation((async (_url: string, body: unknown) => {
    const b = body as { guestInfo?: unknown; holdId?: number };
    if (!b.guestInfo) {
      return { data: { holdId: 7001, holdExpiresAt: FUTURE(), prepToken: 'prep-7001', finalAmount: 4479 } };
    }
    return { data: { keyId: 'rzp_test_x', orderId: 'order_x', bookingId: 7001, bookingToken: 'tok', amount: 4479 } };
  }) as never);
}

describe('GuestDetailsPage - the hold starts at Pay (2026-10-19)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    ctx.info = baseInfo();
    ctx.tenant.bookingMode = 'ONLINE';
    rzp.options = null;
    rzp.handlers = {};
    rzp.opened = 0;
    class MockRazorpay {
      constructor(opts: Record<string, unknown>) {
        rzp.options = opts;
      }
      on(evt: string, h: (r: unknown) => void) {
        rzp.handlers[evt] = h;
      }
      open() {
        rzp.opened += 1;
      }
      close() {}
    }
    window.Razorpay = MockRazorpay as unknown as typeof window.Razorpay;
    seedDraft();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    delete (window as { Razorpay?: unknown }).Razorpay;
  });

  it('arriving on the details page carries NO clock and NO hold', async () => {
    const post = vi.spyOn(axios, 'post');
    await renderPage();

    expect(screen.getByTestId('hold-strip-no-clock')).toHaveTextContent('nothing is held yet');
    expect(screen.getByTestId('hold-header-no-clock')).toBeInTheDocument();
    expect(screen.getByTestId('aside-no-hold-chip')).toHaveTextContent('Nothing is held yet');
    expect(screen.queryByText(/Your dates are reserved for the next/i)).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('Pay starts the hold (init-hold) and THEN charges (final-charge) on that same hold, and the countdown appears', async () => {
    const post = vi.spyOn(axios, 'post');
    mockOrderApi(post);
    await renderPage();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();
    await settle();

    expect(post).toHaveBeenCalledTimes(2);
    const initBody = post.mock.calls[0][1] as { bookingDraft: Record<string, unknown>; guestInfo?: unknown };
    expect(initBody.guestInfo).toBeUndefined();
    expect(initBody.bookingDraft).toMatchObject({ listingId: 637, checkinDate: '2026-10-20', checkoutDate: '2026-10-21', guests: 2 });
    const chargeBody = post.mock.calls[1][1] as { holdId: number; holdToken: string };
    expect(chargeBody.holdId).toBe(7001);
    expect(chargeBody.holdToken).toBe('prep-7001');
    expect(rzp.opened).toBe(1);
    // The clock now runs - and only now.
    expect(screen.getByTestId('hold-strip')).toHaveTextContent(/reserved for the next/i);
  });

  it('if the nights are gone the guest is told BEFORE any money moves: no final-charge, no Razorpay', async () => {
    const post = vi.spyOn(axios, 'post').mockRejectedValue(
      new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 409,
        statusText: 'Conflict',
        data: { code: 'AVAILABILITY_CONFLICT', message: 'Those dates were just taken. Please choose different dates.' },
        headers: {},
        config: {} as never,
      }),
    );
    await renderPage();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();

    expect(screen.getAllByText(/Sorry, these dates were just booked\./).length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('No payment was taken');
    expect(post).toHaveBeenCalledTimes(1); // the hold attempt only
    expect(rzp.opened).toBe(0);
  });

  it('shows the host\'s house rules with a REQUIRED tick: Pay stays disabled until it is ticked, and the final-charge carries it', async () => {
    ctx.info = baseInfo({
      hasHouseRules: true,
      houseRulesText: 'No loud music after 10 pm.',
      houseRulesStructuredJson: '{"smoking":false,"pets":false,"quietHoursStart":"22:00","quietHoursEnd":"08:00"}',
    });
    const post = vi.spyOn(axios, 'post');
    mockOrderApi(post);
    await renderPage();

    const card = screen.getByTestId('house-rules-card');
    expect(card).toHaveTextContent('No loud music after 10 pm.');
    expect(screen.getByTestId('house-rules-chips')).toHaveTextContent('No smoking');
    expect(screen.getByTestId('house-rules-chips')).toHaveTextContent('Quiet hours 22:00 to 08:00');

    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    // Consent alone is not enough: the house rules are not accepted yet.
    expect(screen.getByTestId('guest-booking-submit')).toBeDisabled();

    fireEvent.click(screen.getByTestId('guest-booking-house-rules'));
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();
    await settle();
    const chargeBody = post.mock.calls[1][1] as { houseRulesAccepted: boolean };
    expect(chargeBody.houseRulesAccepted).toBe(true);
  });

  it('a listing with NO house rules shows no tick and never blocks the booking', async () => {
    ctx.info = baseInfo({ hasHouseRules: false });
    await renderPage();
    expect(screen.queryByTestId('house-rules-card')).toBeNull();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();
  });

  it('after a failed payment: "Payment didn\'t go through" with Try again + the HOST\'s WhatsApp (pre-written), never Atlas\'s number; Try again keeps the SAME hold', async () => {
    const post = vi.spyOn(axios, 'post');
    mockOrderApi(post);
    await renderPage();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();
    await settle();
    expect(post).toHaveBeenCalledTimes(2);

    // Razorpay reports the first failure.
    await act(async () => {
      rzp.handlers['payment.failed']({ error: { code: 'BAD_REQUEST_ERROR', description: 'Payment failed' } });
    });
    await settle();

    expect(screen.getByTestId('payment-failed-title')).toHaveTextContent("Payment didn't go through");
    expect(screen.getByTestId('payment-failed-panel')).toHaveTextContent('No money was taken');
    expect(screen.getByTestId('payment-failed-hold-line')).toHaveTextContent(/still held for/i);

    const wa = screen.getByTestId('payment-failed-whatsapp-host') as HTMLAnchorElement;
    expect(wa).toHaveTextContent('Message the host on WhatsApp');
    const url = new URL(wa.href);
    expect(url.origin + url.pathname).toBe('https://wa.me/919123456789'); // the HOST, not 917032493290
    expect(wa.href).not.toContain('917032493290');
    const text = url.searchParams.get('text') ?? '';
    expect(text).toContain('Asha Rao'); // guest name
    expect(text).toContain('Penthouse'); // room
    expect(text).toContain('1 night'); // dates / nights
    expect(text).toContain('2 guests'); // guests
    expect(text).toContain('4,479'); // amount

    // Try again inside the window: the SAME hold (no second hold attempt), i.e. only the final-charge is sent again.
    await act(async () => {
      fireEvent.click(screen.getByTestId('payment-failed-try-again'));
    });
    await settle();
    await settle();
    expect(post).toHaveBeenCalledTimes(3);
    const third = post.mock.calls[2][1] as { holdId?: number; guestInfo?: unknown };
    expect(third.guestInfo).toBeDefined();
    expect(third.holdId).toBe(7001);
    expect(rzp.opened).toBe(2);
  });

  it('with no WhatsApp number the host button is a call link; with no number at all there is no contact button (never Atlas\'s)', async () => {
    ctx.info = baseInfo({ hostWhatsAppDigits: null, hostPhoneDigits: '919123456780' });
    const post = vi.spyOn(axios, 'post');
    mockOrderApi(post);
    await renderPage();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();
    await settle();
    await act(async () => {
      rzp.handlers['payment.failed']({ error: { code: 'BAD_REQUEST_ERROR', description: 'x' } });
    });
    await settle();
    const call = screen.getByTestId('payment-failed-call-host') as HTMLAnchorElement;
    expect(call.getAttribute('href')).toBe('tel:+919123456780');
    expect(screen.queryByTestId('payment-failed-whatsapp-host')).toBeNull();
  });

  it('a host whose listing owner cannot take online payment is handed off with NO call to POST /api/Razorpay/order', async () => {
    ctx.info = baseInfo({ onlinePaymentsAvailable: false, bookingMode: 'WHATSAPP' });
    const post = vi.spyOn(axios, 'post');
    await renderPage();

    expect(screen.queryByTestId('guest-booking-submit')).toBeNull();
    expect(screen.getByTestId('guest-booking-offline-notice')).toBeInTheDocument();
    const cta = screen.getByTestId('guest-booking-whatsapp-cta') as HTMLAnchorElement;
    expect(cta.href).toContain('wa.me/919123456789');
    expect(cta.href).not.toContain('917032493290');
    expect(post).not.toHaveBeenCalled();
  });
});
