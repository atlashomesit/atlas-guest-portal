/**
 * TASK-1039977 / PAY-006: Direct booking guest checkout surfaces refundable security deposit terms and consent.
 * When listing has a required refundable security deposit configured:
 *  - Displays security deposit policy disclosure banner with amount and terms.
 *  - Displays refundable security deposit breakdown in the price summary.
 *  - Requires explicit guest acknowledgement/consent checkbox before Pay.
 *  - Passes securityDepositAccepted: true in final-charge order payload on Pay.
 * When listing has no security deposit:
 *  - Omits deposit banner and breakdown.
 *  - Passes securityDepositAccepted: false in order payload on Pay.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import axios from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingProvider } from '@/contexts/BookingContext';
import { istInstantFromCalendarDate } from '@/utils/date';
import GuestDetailsPage from './GuestDetailsPage';
import { settle } from '../../test/settle';

window.HTMLElement.prototype.scrollIntoView = vi.fn();

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

vi.mock('@/tenant/tenantContext', () => ({
  getTenantContext: () => ({ slug: 'atlas', name: 'Atlas Homes', paymentProvider: 'RAZORPAY', bookingMode: 'ONLINE' }),
}));

vi.mock('@/api/checkoutInfoClient', () => ({
  fetchListingCheckoutInfo: vi.fn(async () => ({
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
    securityDepositAmount: null,
  })),
}));

const CHECKOUT_HOLD_KEY = 'atlas_guest_checkout_hold';

function seedDraft(securityDepositAmount?: number | null) {
  window.sessionStorage.setItem(
    CHECKOUT_HOLD_KEY,
    JSON.stringify({
      savedAt: Date.now(),
      holdListingId: 637,
      holdPropertySlug: 'grove-co',
      holdUnitSlug: 'penthouse',
      holdTenantSlug: 'grove-and-co',
      holdListingName: 'Penthouse Suite',
      holdPriceBreakdown: { baseAmount: 5000, discountAmount: 0, convenienceFeeAmount: 150, finalAmount: 5150, nights: 1, currency: 'INR' },
      checkIn: istInstantFromCalendarDate(new Date(2026, 9, 20)).toISOString(),
      checkOut: istInstantFromCalendarDate(new Date(2026, 9, 21)).toISOString(),
      guests: 2,
      ...(securityDepositAmount != null ? { holdSecurityDepositAmount: securityDepositAmount } : {}),
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
  fireEvent.change(screen.getByTestId('guest-booking-name'), { target: { value: 'Rohan Sharma' } });
  fireEvent.change(screen.getByTestId('guest-booking-email'), { target: { value: 'rohan@example.com' } });
  fireEvent.change(screen.getByTestId('guest-booking-phone'), { target: { value: '9876543210' } });
}

describe('GuestDetailsPage - TASK-1039977: security deposit disclosure and consent (PAY-006)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('displays security deposit policy banner, breakdown, and requires checkbox when listing has securityDepositAmount', async () => {
    seedDraft(3000);
    await renderPage();

    // Disclosure banner & breakdown
    const banner = screen.getByTestId('security-deposit-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Refundable Security Deposit: ₹3,000');
    expect(banner).toHaveTextContent('incidental damages');

    const breakdown = screen.getByTestId('security-deposit-breakdown');
    expect(breakdown).toBeInTheDocument();
    expect(breakdown).toHaveTextContent('₹3,000');

    // Consent checkbox
    const depositCheckbox = screen.getByTestId('guest-booking-deposit-consent');
    expect(depositCheckbox).toBeInTheDocument();
    expect(depositCheckbox).not.toBeChecked();

    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));

    // Pay button remains disabled because deposit consent is not ticked
    expect(screen.getByTestId('guest-booking-submit')).toBeDisabled();
    expect(document.body.textContent).toContain('refundable security deposit agreement');

    // Ticking the deposit consent enables Pay
    fireEvent.click(depositCheckbox);
    expect(depositCheckbox).toBeChecked();
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();

    // Unticking disables Pay again
    fireEvent.click(depositCheckbox);
    expect(screen.getByTestId('guest-booking-submit')).toBeDisabled();
  });

  it('sends securityDepositAccepted: true on Pay when deposit is accepted', async () => {
    class MockRazorpay {
      on() {}
      open() {}
      close() {}
    }
    window.Razorpay = MockRazorpay as unknown as typeof window.Razorpay;
    const post = vi.spyOn(axios, 'post').mockImplementation((async (_url: string, body: unknown) => {
      if (!(body as { guestInfo?: unknown }).guestInfo) {
        return { data: { holdId: 8001, holdExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), prepToken: 'prep-8001', finalAmount: 5150 } };
      }
      return { data: { keyId: 'rzp_test_x', orderId: 'order_x', bookingId: 8001, bookingToken: 'tok', amount: 5150 } };
    }) as never);

    seedDraft(2500);
    await renderPage();
    fillDetails();

    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    fireEvent.click(screen.getByTestId('guest-booking-deposit-consent'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();
    await settle();

    const charge = post.mock.calls
      .map((c) => c[1] as { guestInfo?: unknown; securityDepositAccepted?: boolean })
      .find((b) => b.guestInfo);

    expect(charge?.securityDepositAccepted).toBe(true);

    post.mockRestore();
    delete (window as { Razorpay?: unknown }).Razorpay;
  });

  it('omits security deposit banner and sends securityDepositAccepted: false when no deposit configured', async () => {
    class MockRazorpay {
      on() {}
      open() {}
      close() {}
    }
    window.Razorpay = MockRazorpay as unknown as typeof window.Razorpay;
    const post = vi.spyOn(axios, 'post').mockImplementation((async (_url: string, body: unknown) => {
      if (!(body as { guestInfo?: unknown }).guestInfo) {
        return { data: { holdId: 8002, holdExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), prepToken: 'prep-8002', finalAmount: 5150 } };
      }
      return { data: { keyId: 'rzp_test_x', orderId: 'order_x', bookingId: 8002, bookingToken: 'tok', amount: 5150 } };
    }) as never);

    seedDraft(null);
    await renderPage();

    expect(screen.queryByTestId('security-deposit-banner')).toBeNull();
    expect(screen.queryByTestId('security-deposit-breakdown')).toBeNull();
    expect(screen.queryByTestId('guest-booking-deposit-consent')).toBeNull();

    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));

    // Pay button enabled without needing deposit tick
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();
    await settle();

    const charge = post.mock.calls
      .map((c) => c[1] as { guestInfo?: unknown; securityDepositAccepted?: boolean })
      .find((b) => b.guestInfo);

    expect(charge?.securityDepositAccepted).toBe(false);

    post.mockRestore();
    delete (window as { Razorpay?: unknown }).Razorpay;
  });
});
