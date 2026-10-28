/**
 * TASK-1039907 (guest half): the optional, UNticked "ads measurement" consent at checkout.
 *   - never pre-ticked, optional (Pay does not wait for it);
 *   - the label is the API's versioned consent text (ads_measurement-v1-2026-10), word for word;
 *   - `guestPurposeConsents.ads_measurement: true` is posted ONLY when ticked (the API treats `false` as a withdrawal,
 *     so an unticked box must send nothing).
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import axios from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingProvider } from '@/contexts/BookingContext';
import { istInstantFromCalendarDate } from '@/utils/date';
import { buildAdsMeasurementConsentText, ADS_MEASUREMENT_CONSENT_VERSION } from '@/content/consent/adsMeasurementConsent';
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

vi.mock('@/tenant/displayBrand', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getGuestDataProcessingEntityName: () => 'Grove & Co',
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

/** The exact text the API serves for ads_measurement-v1-2026-10 (GuestConsentConstants.BuildPurposeDisplayText), who = "Grove & Co". */
const API_TEXT_V1_2026_10 =
  'I consent to Grove & Co sharing a scrambled (hashed) version of my phone number and email address, and the value of my booking, ' +
  'with Meta (Facebook, Instagram, WhatsApp) so that the ads which brought me to Grove & Co can be measured. I can withdraw this at any time.';

const CHECKOUT_HOLD_KEY = 'atlas_guest_checkout_hold';

function seedDraft() {
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

function mockCheckoutPosts() {
  class MockRazorpay {
    on() {}
    open() {}
    close() {}
  }
  window.Razorpay = MockRazorpay as unknown as typeof window.Razorpay;
  return vi.spyOn(axios, 'post').mockImplementation((async (_url: string, body: unknown) => {
    if (!(body as { guestInfo?: unknown }).guestInfo) {
      return { data: { holdId: 9001, holdExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), prepToken: 'prep-9001', finalAmount: 5150 } };
    }
    return { data: { keyId: 'rzp_test_x', orderId: 'order_x', bookingId: 9001, bookingToken: 'tok', amount: 5150 } };
  }) as never);
}

type ChargeBody = { guestInfo?: unknown; guestPurposeConsents?: Record<string, boolean> };
function chargeBody(post: ReturnType<typeof mockCheckoutPosts>): ChargeBody | undefined {
  return post.mock.calls.map((c) => c[1] as ChargeBody).find((b) => b.guestInfo);
}

async function pay() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('guest-booking-submit'));
  });
  await settle();
  await settle();
}

describe('GuestDetailsPage - TASK-1039907: optional ads-measurement consent', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    window.localStorage.clear();
    delete (window as { Razorpay?: unknown }).Razorpay;
    vi.restoreAllMocks();
  });

  it('the shared text builder is word for word the API text for ads_measurement-v1-2026-10', () => {
    expect(ADS_MEASUREMENT_CONSENT_VERSION).toBe('ads_measurement-v1-2026-10');
    expect(buildAdsMeasurementConsentText('Grove & Co')).toBe(API_TEXT_V1_2026_10);
    expect(buildAdsMeasurementConsentText('  ')).toContain('the operator of this site');
  });

  it('shows an unticked, optional checkbox with the API consent text, and Pay does not wait for it', async () => {
    seedDraft();
    await renderPage();

    const box = screen.getByTestId('guest-booking-ads-measurement-consent');
    expect(box).toBeInTheDocument();
    expect(box).not.toBeChecked();
    expect(box).not.toBeRequired();
    expect(screen.getByTestId('guest-booking-ads-measurement-consent-text').textContent).toBe(API_TEXT_V1_2026_10);
    expect(screen.getByTestId('guest-booking-ads-measurement-consent-row')).toHaveTextContent(/Optional/);

    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled(); // ads consent never gates Pay
    expect(box).not.toBeChecked();
  });

  it('unticked: the order carries NO ads_measurement key at all (false would withdraw an earlier consent)', async () => {
    const post = mockCheckoutPosts();
    seedDraft();
    await renderPage();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    await pay();

    const charge = chargeBody(post);
    expect(charge?.guestPurposeConsents).toBeDefined();
    expect(charge?.guestPurposeConsents?.booking_contact).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(charge!.guestPurposeConsents!, 'ads_measurement')).toBe(false);
  });

  it('ticked: posts guestPurposeConsents.ads_measurement = true', async () => {
    const post = mockCheckoutPosts();
    seedDraft();
    await renderPage();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    fireEvent.click(screen.getByTestId('guest-booking-ads-measurement-consent'));
    expect(screen.getByTestId('guest-booking-ads-measurement-consent')).toBeChecked();
    await pay();

    const charge = chargeBody(post);
    expect(charge?.guestPurposeConsents?.ads_measurement).toBe(true);
    expect(charge?.guestPurposeConsents?.booking_contact).toBe(true);
  });

  it('ticked then unticked again: nothing is sent', async () => {
    const post = mockCheckoutPosts();
    seedDraft();
    await renderPage();
    fillDetails();
    fireEvent.click(screen.getByTestId('guest-booking-consent'));
    fireEvent.click(screen.getByTestId('guest-booking-ads-measurement-consent'));
    fireEvent.click(screen.getByTestId('guest-booking-ads-measurement-consent'));
    await pay();

    const charge = chargeBody(post);
    expect(Object.prototype.hasOwnProperty.call(charge!.guestPurposeConsents!, 'ads_measurement')).toBe(false);
  });
});
