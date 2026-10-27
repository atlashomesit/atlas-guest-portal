/**
 * HSL-011 - a Women-only / Men-only dorm makes the guest tick the rule before Pay:
 *   - the tick is REQUIRED: Pay stays disabled until it is ticked (on top of the consent tick);
 *   - the copy states the rule and makes NO refund claim;
 *   - a mixed dorm and a non-dorm listing show no tick and never block the booking.
 * The policy reaches the page the way it does in production: Reserve stores it on the checkout draft
 * (`holdDormGenderPolicy`), which the page rehydrates into BookingContext.
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
  })),
}));

const CHECKOUT_HOLD_KEY = 'atlas_guest_checkout_hold';

function seedDraft(holdDormGenderPolicy: string | null) {
  window.sessionStorage.setItem(
    CHECKOUT_HOLD_KEY,
    JSON.stringify({
      savedAt: Date.now(),
      holdListingId: 637,
      holdPropertySlug: 'grove-co',
      holdUnitSlug: 'dorm',
      holdTenantSlug: 'grove-and-co',
      holdListingName: '6-Bed Dorm',
      holdPriceBreakdown: { baseAmount: 4794, discountAmount: 0, convenienceFeeAmount: 144, finalAmount: 4938, nights: 2, currency: 'INR' },
      checkIn: istInstantFromCalendarDate(new Date(2026, 9, 20)).toISOString(),
      checkOut: istInstantFromCalendarDate(new Date(2026, 9, 22)).toISOString(),
      guests: 3,
      ...(holdDormGenderPolicy ? { holdDormGenderPolicy } : {}),
    }),
  );
}

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/book/grove-co/dorm/details?tenant=grove-and-co']}>
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

describe('GuestDetailsPage - HSL-011 dorm gender rule tick before Pay', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('women-only dorm: Pay stays disabled until the rule tick is ticked, even with consent ticked', async () => {
    seedDraft('FemaleOnly');
    await renderPage();

    const card = screen.getByTestId('dorm-gender-ack-card');
    expect(card).toHaveTextContent('Women-only dorm');
    expect(card.textContent).not.toMatch(/refund/i);

    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    expect(screen.getByTestId('guest-booking-submit')).toBeDisabled();
    expect(document.body.textContent).toContain('Confirm the dorm rule');

    fireEvent.click(screen.getByTestId('dorm-gender-ack-checkbox'));
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();

    // Un-ticking closes the gate again.
    fireEvent.click(screen.getByTestId('dorm-gender-ack-checkbox'));
    expect(screen.getByTestId('guest-booking-submit')).toBeDisabled();
  });

  it('men-only dorm: the same required tick, worded for men', async () => {
    seedDraft('MaleOnly');
    await renderPage();
    expect(screen.getByTestId('dorm-gender-ack-card')).toHaveTextContent('Men-only dorm');
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    expect(screen.getByTestId('guest-booking-submit')).toBeDisabled();
    fireEvent.click(screen.getByTestId('dorm-gender-ack-checkbox'));
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();
  });

  it('the order request carries dormGenderAcknowledged: true once the rule is ticked', async () => {
    class MockRazorpay {
      on() {}
      open() {}
      close() {}
    }
    window.Razorpay = MockRazorpay as unknown as typeof window.Razorpay;
    const post = vi.spyOn(axios, 'post').mockImplementation((async (_url: string, body: unknown) => {
      if (!(body as { guestInfo?: unknown }).guestInfo) {
        return { data: { holdId: 7001, holdExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), prepToken: 'prep-7001', finalAmount: 4938 } };
      }
      return { data: { keyId: 'rzp_test_x', orderId: 'order_x', bookingId: 7001, bookingToken: 'tok', amount: 4938 } };
    }) as never);
    seedDraft('MaleOnly');
    await renderPage();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    fireEvent.click(screen.getByTestId('dorm-gender-ack-checkbox'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();
    await settle();

    const charge = post.mock.calls.map((c) => c[1] as { guestInfo?: unknown; dormGenderAcknowledged?: boolean }).find((b) => b.guestInfo);
    expect(charge?.dormGenderAcknowledged).toBe(true);
    post.mockRestore();
    delete (window as { Razorpay?: unknown }).Razorpay;
  });

  it('the mobile Pay bar does not submit while the rule tick is open', async () => {
    seedDraft('FemaleOnly');
    await renderPage();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    expect(screen.getByTestId('guest-booking-submit-mobile')).toHaveAttribute('type', 'button');
    fireEvent.click(screen.getByTestId('guest-booking-submit-mobile'));
    expect(screen.getByTestId('dorm-gender-ack-card')).toHaveTextContent('Please confirm the dorm rule to continue.');
    fireEvent.click(screen.getByTestId('dorm-gender-ack-checkbox'));
    expect(screen.getByTestId('guest-booking-submit-mobile')).toHaveAttribute('type', 'submit');
  });

  it('a mixed dorm shows no tick and never blocks the booking', async () => {
    seedDraft('Mixed');
    await renderPage();
    expect(screen.queryByTestId('dorm-gender-ack-card')).toBeNull();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();
  });

  it('a non-dorm listing shows no tick and never blocks the booking', async () => {
    seedDraft(null);
    await renderPage();
    expect(screen.queryByTestId('dorm-gender-ack-card')).toBeNull();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();
  });
});
