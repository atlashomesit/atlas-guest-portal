/**
 * AGT-003: a code that arrived on a checkout LINK (?promo=, remembered under atlas_guest_promo_from_link) is validated and
 * applied on load, so the guest sees the discounted total with no tap. A code typed by hand keeps the Apply button.
 * The total on screen is the amount the order charges, and the saving is its own line.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import axios from 'axios';
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

const KEY = 'atlas_guest_promo_code';
const LINK_KEY = 'atlas_guest_promo_from_link';

type Validate = { valid: boolean; message: string; discountAmount?: number; discountType?: string; discountValue?: number };
const GOOD: Validate = { valid: true, message: '20% off applied', discountAmount: 870, discountType: 'Percent', discountValue: 20 };

function mockFetch(validate: Validate | 'down') {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: unknown) => {
    if (typeof url === 'string' && url.includes('/api/promo-codes/validate')) {
      if (validate === 'down') throw new Error('offline');
      return { ok: true, json: async () => validate } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  }) as typeof fetch);
}
const validateCalls = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.filter((c) => String(c[0]).includes('/api/promo-codes/validate'));

function mockOrderApi(post: ReturnType<typeof vi.spyOn>, amount: number, promo: { code: string; discount: number } | null) {
  post.mockImplementation((async (_url: string, body: unknown) => {
    const b = body as { guestInfo?: unknown };
    if (!b.guestInfo) return { data: { holdId: 7001, holdExpiresAt: FUTURE(), prepToken: 'prep-7001', finalAmount: 4479 } };
    return {
      data: {
        keyId: 'rzp_test_x', orderId: 'order_x', bookingId: 7001, bookingToken: 'tok', amount,
        ...(promo ? { appliedPromoCode: promo.code, promoDiscountAmount: promo.discount } : {}),
      },
    };
  }) as never);
}

const PLAIN_FALLBACK = "That offer can't be used for this stay, so the normal price applies.";

describe('GuestDetailsPage - AGT-003 promo from a checkout link', () => {
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

  function seedLinkCode() {
    window.localStorage.setItem(KEY, 'AI12345678');
    window.localStorage.setItem(LINK_KEY, 'AI12345678');
  }

  it('applies a link code on load with no tap: discounted total, saving as its own line', async () => {
    seedLinkCode();
    const f = mockFetch(GOOD);
    await renderPage();
    expect(validateCalls(f)).toHaveLength(1);
    expect(JSON.parse(String((validateCalls(f)[0][1] as RequestInit).body))).toMatchObject({ code: 'AI12345678', listingId: 637, subtotal: 4350 });
    expect(screen.getByTestId('promo-confirmed-row')).toHaveTextContent('Promo discount');
    expect(screen.getByTestId('promo-confirmed-row')).toHaveTextContent('−₹870');
    expect(screen.getByTestId('checkout-total-amount')).toHaveTextContent('₹3,609'); // 4,479 - 870
  });

  it('the total shown is the amount the order charges (no "Total updated" gate) and the order carries the code', async () => {
    seedLinkCode();
    mockFetch(GOOD);
    const post = vi.spyOn(axios, 'post');
    mockOrderApi(post, 3609, { code: 'AI12345678', discount: 870 });
    await renderPage();
    const shown = screen.getByTestId('checkout-total-amount').textContent;
    expect(shown).toContain('₹3,609');
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();
    await settle();
    const chargeBody = post.mock.calls[1][1] as { promoCode?: string };
    expect(chargeBody.promoCode).toBe('AI12345678');
    expect(screen.queryByTestId('guest-checkout-total-updated')).toBeNull();
    expect(rzp.opened).toBe(1);
    expect(rzp.options?.amount).toBe(360900); // paise charged == INR 3,609 shown
    expect(screen.getByTestId('checkout-total-amount').textContent).toBe(shown);
  });

  it('an invalid link code gives one plain sentence, the normal price, and is forgotten; Pay is not blocked', async () => {
    seedLinkCode();
    mockFetch({ valid: false, message: 'Promo code has expired.' });
    const post = vi.spyOn(axios, 'post');
    mockOrderApi(post, 4479, null);
    await renderPage();
    expect(screen.getByText(PLAIN_FALLBACK)).toBeInTheDocument();
    expect(screen.getByTestId('checkout-total-amount')).toHaveTextContent('₹4,479');
    expect(screen.queryByTestId('promo-confirmed-row')).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(window.localStorage.getItem(LINK_KEY)).toBeNull();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();
    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();
    await settle();
    expect((post.mock.calls[1][1] as { promoCode?: string }).promoCode).toBeUndefined();
    expect(rzp.opened).toBe(1);
  });

  it('a failed check (offline) also falls back to the normal price and never blocks', async () => {
    seedLinkCode();
    mockFetch('down');
    await renderPage();
    expect(screen.getByText(PLAIN_FALLBACK)).toBeInTheDocument();
    expect(screen.getByTestId('checkout-total-amount')).toHaveTextContent('₹4,479');
  });

  it("a code typed or copied by hand keeps today's behaviour: not applied on load, only on Apply, total unchanged until the order", async () => {
    window.localStorage.setItem(KEY, 'FIRSTSTAY'); // no link key: banner or hand-typed
    const f = mockFetch(GOOD);
    await renderPage();
    expect(validateCalls(f)).toHaveLength(0);
    expect(screen.queryByTestId('promo-confirmed-row')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /promo code/i }));
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    await settle();
    expect(validateCalls(f)).toHaveLength(1);
    expect(screen.getByTestId('promo-savings-chip')).toBeInTheDocument();
    expect(screen.queryByTestId('promo-confirmed-row')).toBeNull();
    expect(screen.getByTestId('checkout-total-amount')).toHaveTextContent('₹4,479');
  });

  it('a stored code that fails for this home is cleared so it cannot follow the guest on', async () => {
    window.localStorage.setItem(KEY, 'FIRSTSTAY');
    mockFetch({ valid: false, message: 'Promo code is not valid for this listing.' });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /promo code/i }));
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    await settle();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('the code is cleared after a successful booking', async () => {
    seedLinkCode();
    mockFetch(GOOD);
    const post = vi.spyOn(axios, 'post');
    mockOrderApi(post, 3609, { code: 'AI12345678', discount: 870 });
    await renderPage();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();
    await settle();
    post.mockImplementation((async () => ({ data: { success: true } })) as never);
    await act(async () => {
      await (rzp.options?.handler as (r: unknown) => Promise<void>)({
        razorpay_payment_id: 'pay_1',
        razorpay_order_id: 'order_x',
        razorpay_signature: 'sig',
      });
    });
    await settle();
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(window.localStorage.getItem(LINK_KEY)).toBeNull();
  });
});
