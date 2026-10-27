/**
 * PAY-010: a host on UPI_QR / UPI_DEEPLINK gets no Razorpay order. The order response carries `provider`, a `upi://pay`
 * link, the host's UPI address and an inline QR. Before the fix the page ignored `provider` and launched Razorpay with
 * the UPI address as the key, so these guests could not pay at all. Branch test: Razorpay response -> Razorpay opens
 * (unchanged); UPI response -> the UPI panel (link / QR / UPI ID / countdown), Razorpay never constructed, and
 * "I have paid" only TELLS the host (POST guest-reported-paid) and moves to the booking page: never marks it paid.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import axios from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
  constructed: 0,
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
        <Routes>
          <Route path="/book/:propertySlug/:unitSlug/details" element={<GuestDetailsPage />} />
          <Route path="/booking/:id" element={<div data-testid="booking-page-route">booking page</div>} />
        </Routes>
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
const UPI_URI = 'upi://pay?pa=host%40okbank&pn=Grove&am=4479.00&cu=INR&tn=Booking+%237001&tr=ATL-7001-00042';
const QR = 'data:image/svg+xml;base64,PHN2Zy8+';

function mockOrderApi(post: ReturnType<typeof vi.spyOn>, finalCharge: Record<string, unknown>) {
  post.mockImplementation((async (_url: string, body: unknown) => {
    const b = body as { guestInfo?: unknown };
    if (!b.guestInfo) {
      return { data: { holdId: 7001, holdExpiresAt: FUTURE(), prepToken: 'prep-7001', finalAmount: 4479 } };
    }
    return { data: finalCharge };
  }) as never);
}

function upiOrder(provider: 'UPI_QR' | 'UPI_DEEPLINK') {
  return {
    keyId: 'host@okbank', orderId: 'ATL-7001-00042', bookingId: 7001, bookingToken: 'tok-7001', amount: 4479,
    holdExpiresAtUtc: FUTURE(), provider, upiUri: UPI_URI, upiVpa: 'host@okbank', qrCodeUrl: QR,
  };
}

async function tapPay() {
  fillDetails();
  fireEvent.click(screen.getByTestId('guest-booking-consent'));
  await act(async () => {
    fireEvent.click(screen.getByTestId('guest-booking-submit'));
  });
  await settle();
  await settle();
}

describe('GuestDetailsPage - PAY-010 provider branch (Razorpay vs UPI)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    ctx.info = baseInfo();
    rzp.options = null;
    rzp.handlers = {};
    rzp.opened = 0;
    rzp.constructed = 0;
    class MockRazorpay {
      constructor(opts: Record<string, unknown>) {
        rzp.options = opts;
        rzp.constructed += 1;
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

  it('Razorpay host: the order opens Razorpay exactly as before, and no UPI panel is shown', async () => {
    const post = vi.spyOn(axios, 'post');
    mockOrderApi(post, { keyId: 'rzp_test_x', orderId: 'order_x', bookingId: 7001, bookingToken: 'tok', amount: 4479, provider: null });
    await renderPage();
    await tapPay();

    expect(rzp.opened).toBe(1);
    expect(rzp.options?.key).toBe('rzp_test_x');
    expect(screen.queryByTestId('upi-pay-panel')).toBeNull();
  });

  it('UPI host: shows Pay with UPI (QR, UPI ID, reference, countdown) and NEVER constructs Razorpay', async () => {
    const post = vi.spyOn(axios, 'post');
    mockOrderApi(post, upiOrder('UPI_DEEPLINK'));
    await renderPage();
    await tapPay();

    expect(rzp.constructed).toBe(0);
    expect(rzp.opened).toBe(0);
    expect(screen.getByTestId('upi-pay-panel')).toBeInTheDocument();
    expect(screen.getByTestId('upi-pay-title')).toHaveTextContent('Pay ₹4,479 with UPI');
    expect(screen.getByTestId('upi-pay-vpa')).toHaveTextContent('host@okbank');
    expect(screen.getByTestId('upi-pay-qr')).toHaveAttribute('src', QR);
    expect(screen.getByTestId('upi-pay-reference')).toHaveTextContent('ATL-7001-00042');
    expect(screen.getByTestId('upi-pay-hold-line')).toHaveTextContent(/Your dates are held for \d+:\d\d/);
  });

  it('UPI host on a phone: the main action is the one-tap upi:// link', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    );
    const post = vi.spyOn(axios, 'post');
    mockOrderApi(post, upiOrder('UPI_QR'));
    await renderPage();
    await tapPay();

    expect(screen.getByTestId('upi-pay-open-app')).toHaveAttribute('href', UPI_URI);
    expect(rzp.constructed).toBe(0);
  });

  it('"I have paid" only tells the host (guest-reported-paid with the booking token) and moves to the booking page', async () => {
    const post = vi.spyOn(axios, 'post');
    mockOrderApi(post, upiOrder('UPI_DEEPLINK'));
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/upi-deeplink/guest-reported-paid')) {
        return new Response(JSON.stringify({ status: 'awaiting_host_confirmation' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }) as never);
    await renderPage();
    await tapPay();

    await act(async () => {
      fireEvent.click(screen.getByTestId('upi-pay-i-have-paid'));
    });
    await settle();
    await settle();

    const reportCall = fetchSpy.mock.calls.find(([u]) => String(u).includes('/api/upi-deeplink/guest-reported-paid'));
    expect(reportCall).toBeTruthy();
    expect(JSON.parse(String((reportCall![1] as RequestInit).body))).toEqual({ bookingId: 7001, bookingToken: 'tok-7001' });
    // Never a Razorpay verify: nothing on this page can mark the booking paid.
    expect(post.mock.calls.some(([u]) => String(u).includes('/api/Razorpay/verify'))).toBe(false);
    expect(screen.getByTestId('booking-page-route')).toBeInTheDocument();
  });
});
