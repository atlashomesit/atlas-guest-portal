/**
 * 2026-10-29 - a guest must never be left with a Pay tap that does nothing and says nothing.
 *
 * Every way `handleSubmit` can return BEFORE the order request is pinned here, and each one has to leave a visible
 * message with role="alert" that says what to fix or why the guest cannot book:
 *   1. details / consent missing           -> inline alert per field + one summary alert naming all of them
 *   2. house rules not ticked              -> same, naming the house rules
 *   3. dorm rule not ticked                -> same, naming the dorm rule
 *   4. security deposit not accepted       -> same, naming the deposit terms
 *   5. host cannot take online payment     -> the offline notice is an ALERT once the guest has tapped Pay
 *   6. property not taking bookings        -> the "not taking bookings" alert
 *   7. no stay draft                       -> the "pick your dates again" dialog
 * (The sixth early return, `isSubmitting`, is a double tap while the first one runs: the button already reads
 * "Securing your booking" and a second order must not start, which the holdAtPay suite covers.)
 *
 * No order request may be sent in any of them (axios.post is spied and must stay untouched).
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import axios from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingProvider } from '@/contexts/BookingContext';
import { istInstantFromCalendarDate } from '@/utils/date';
import GuestDetailsPage from './GuestDetailsPage';
import { settle } from '../../test/settle';

window.HTMLElement.prototype.scrollIntoView = vi.fn();

const h = vi.hoisted(() => ({
  tenant: { slug: 'atlas', name: 'Atlas Homes', paymentProvider: 'RAZORPAY', bookingMode: 'ONLINE' } as Record<string, unknown>,
  checkout: {} as Record<string, unknown>,
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
vi.mock('@/tenant/tenantContext', () => ({
  getTenantContext: () => h.tenant,
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
    ...h.checkout,
  })),
}));

const CHECKOUT_HOLD_KEY = 'atlas_guest_checkout_hold';

function seedDraft(holdDormGenderPolicy: string | null = null) {
  window.sessionStorage.setItem(
    CHECKOUT_HOLD_KEY,
    JSON.stringify({
      savedAt: Date.now(),
      holdListingId: 637,
      holdPropertySlug: 'grove-co',
      holdUnitSlug: 'room',
      holdTenantSlug: 'grove-and-co',
      holdListingName: 'Garden Room',
      holdPriceBreakdown: { baseAmount: 4794, discountAmount: 0, convenienceFeeAmount: 144, finalAmount: 4938, nights: 2, currency: 'INR' },
      checkIn: istInstantFromCalendarDate(new Date(2026, 9, 20)).toISOString(),
      checkOut: istInstantFromCalendarDate(new Date(2026, 9, 22)).toISOString(),
      guests: 2,
      ...(holdDormGenderPolicy ? { holdDormGenderPolicy } : {}),
    }),
  );
}

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/book/grove-co/room/details?tenant=grove-and-co']}>
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

/** An Enter-key submit: reaches handleSubmit even while the Pay button is disabled (a disabled button swallows a click, a form submit does not). */
function submitForm() {
  const form = document.getElementById('gd-details-form') as HTMLFormElement;
  fireEvent.submit(form);
}

describe('GuestDetailsPage - every early return of handleSubmit tells the guest why', () => {
  let post: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    h.tenant = { slug: 'atlas', name: 'Atlas Homes', paymentProvider: 'RAZORPAY', bookingMode: 'ONLINE' };
    h.checkout = {};
    post = vi.spyOn(axios, 'post');
  });
  afterEach(() => {
    expect(post).not.toHaveBeenCalled(); // not one order request left the page in any of these refusals
    post.mockRestore();
    cleanup();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('1. empty details and consent: an alert on every field and ONE summary alert naming them all', async () => {
    seedDraft();
    await renderPage();

    submitForm();

    const summary = screen.getByTestId('guest-checkout-validation-summary');
    expect(summary).toHaveAttribute('role', 'alert');
    expect(summary).toHaveTextContent('Payment has not started');
    expect(summary).toHaveTextContent('your name, a valid email address, a valid phone number and the booking consent');
    expect(screen.getByText('Name is required')).toHaveAttribute('role', 'alert');
    expect(screen.getByText('Email is required')).toHaveAttribute('role', 'alert');
    expect(screen.getByText('Phone number is required')).toHaveAttribute('role', 'alert');
    expect(screen.getByText('Please accept the consent to continue.')).toHaveAttribute('role', 'alert');
  });

  it('1b. a malformed email says so (not just "required")', async () => {
    seedDraft();
    await renderPage();
    fillDetails();
    fireEvent.change(screen.getByTestId('guest-booking-email'), { target: { value: 'asha@' } });
    fireEvent.click(screen.getByTestId('guest-booking-consent'));

    submitForm();

    expect(screen.getByText('Please enter a valid email address')).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('guest-checkout-validation-summary')).toHaveTextContent('a valid email address');
  });

  it('1c. the summary goes away once the guest has fixed what it named', async () => {
    seedDraft();
    await renderPage();
    submitForm();
    expect(screen.getByTestId('guest-checkout-validation-summary')).toBeInTheDocument();

    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));

    // Typing clears each field's error and ticking clears the consent error: nothing is left to fix, so the sentence is not stale.
    expect(screen.queryByTestId('guest-checkout-validation-summary')).toBeNull();
  });

  it('2. house rules not ticked: the alert names the house rules', async () => {
    h.checkout = { hasHouseRules: true, houseRulesText: 'No parties after 10 pm.' };
    seedDraft();
    await renderPage();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));

    submitForm();

    const summary = screen.getByTestId('guest-checkout-validation-summary');
    expect(summary).toHaveAttribute('role', 'alert');
    expect(summary).toHaveTextContent('the house rules');
    expect(screen.getByText('Please accept the house rules to continue.')).toHaveAttribute('role', 'alert');
  });

  it('3. women-only dorm rule not ticked: the alert names the dorm rule', async () => {
    seedDraft('FemaleOnly');
    await renderPage();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));

    submitForm();

    expect(screen.getByTestId('guest-checkout-validation-summary')).toHaveTextContent('the dorm rule');
    expect(screen.getByText('Please confirm the dorm rule to continue.')).toHaveAttribute('role', 'alert');
  });

  it('4. security deposit not accepted: the alert names the deposit terms', async () => {
    h.checkout = { securityDepositAmount: 2000 };
    seedDraft();
    await renderPage();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));

    submitForm();

    expect(screen.getByTestId('guest-checkout-validation-summary')).toHaveTextContent('the security deposit terms');
    expect(screen.getByText('Please accept the refundable security deposit terms to continue.')).toHaveAttribute('role', 'alert');
  });

  it('5. host cannot take online payment: the notice is a status while quiet and an ALERT once Pay was tapped', async () => {
    h.checkout = { onlinePaymentsAvailable: false };
    seedDraft();
    await renderPage();

    const quiet = screen.getByTestId('guest-booking-offline-notice');
    expect(quiet).toHaveAttribute('role', 'status');
    expect(quiet).toHaveTextContent('Online payment is not available for this property.');

    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    submitForm();

    const refused = screen.getByTestId('guest-booking-offline-notice');
    expect(refused).toHaveAttribute('role', 'alert');
    expect(refused).toHaveTextContent('Online payment is not available for this property.');
  });

  it('6. property not taking bookings: a submit shows the not-taking-bookings alert', async () => {
    h.tenant = { ...h.tenant, notTakingBookings: true };
    seedDraft();
    await renderPage();
    // The calm explanation is already on the page, with no Pay button to tap.
    expect(screen.getByTestId('guest-not-taking-bookings-notice')).toHaveTextContent('This property is not taking bookings right now.');

    submitForm();

    const alert = screen.getByTestId('guest-checkout-order-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(within(alert).getByText('This property is not taking bookings right now.')).toBeInTheDocument();
  });

  it('7. no stay draft: the guest is told to pick the dates again', async () => {
    // nothing seeded: the page has no stay to charge
    await renderPage();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent("Let's pick your dates again");
    expect(within(dialog).getByRole('button', { name: 'Choose dates' })).toBeInTheDocument();
  });
});
