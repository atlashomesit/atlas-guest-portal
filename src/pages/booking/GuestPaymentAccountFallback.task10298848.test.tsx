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
    slug: 'grove-and-co',
    name: 'Grove & Co.',
    paymentProvider: 'RAZORPAY' as string | undefined,
    bookingMode: 'ONLINE' as 'ONLINE' | 'WHATSAPP' | undefined,
    whatsappBookingPhone: '917032493290' as string | undefined,
    legalContactPack: undefined as undefined | { contactPhone?: string },
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

function baseInfo(over: Partial<ListingCheckoutInfo> = {}): ListingCheckoutInfo {
  return {
    listingId: 676,
    hostName: 'Grove & Co',
    hasHouseRules: false,
    houseRulesText: null,
    houseRulesPdfUrl: null,
    houseRulesStructuredJson: null,
    hostWhatsAppDigits: '919876543210',
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
      holdListingId: 676,
      holdPropertySlug: 'grove-co',
      holdUnitSlug: 'estate',
      holdTenantSlug: 'grove-and-co',
      holdListingName: 'The Estate by Grove & Co.',
      holdPriceBreakdown: {
        baseAmount: 12000,
        discountAmount: 0,
        convenienceFeeAmount: 360,
        finalAmount: 12360,
        nights: 2,
        currency: 'INR',
      },
      checkIn: istInstantFromCalendarDate(new Date(2026, 9, 20)).toISOString(),
      checkOut: istInstantFromCalendarDate(new Date(2026, 9, 22)).toISOString(),
      guests: 2,
    }),
  );
}

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/book/grove-co/estate/details?tenant=grove-and-co']}>
      <BookingProvider>
        <GuestDetailsPage />
      </BookingProvider>
    </MemoryRouter>,
  );
  await settle();
  await settle();
}

describe('TASK-10298848: Guest Payment Account Fallback', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    seedDraft();
    ctx.info = baseInfo();
    ctx.tenant.bookingMode = 'ONLINE';
    ctx.tenant.paymentProvider = 'RAZORPAY';
    ctx.tenant.legalContactPack = undefined;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('when checkout info returns onlinePaymentsAvailable: false, does NOT show dead Pay button and displays WhatsApp fallback', async () => {
    ctx.info = baseInfo({
      onlinePaymentsAvailable: false,
      hostWhatsAppDigits: '919876543210',
    });
    const postSpy = vi.spyOn(axios, 'post');

    await renderPage();

    // 1. "Pay" button must NOT be in the document (neither dead nor disabled).
    expect(screen.queryByTestId('guest-booking-submit')).toBeNull();
    expect(screen.queryByTestId('guest-booking-submit-mobile')).toBeNull();

    // 2. Banner informs guest that online payment is not enabled for this property.
    const notice = screen.getByTestId('guest-booking-offline-notice');
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toMatch(/online payment is currently not enabled/i);

    // 3. Gracefully displays the "Contact Host via WhatsApp" / "Request to Book" fallback button.
    const cta = screen.getByTestId('guest-booking-whatsapp-cta') as HTMLAnchorElement;
    expect(cta).toBeInTheDocument();
    expect(cta.href).toContain('wa.me/919876543210');
    expect(cta.textContent).toMatch(/Contact Host via WhatsApp/i);
    expect(cta.textContent).toMatch(/Request to Book/i);

    // 4. Mobile sticky CTA is also an active WhatsApp link, never a disabled button.
    const mobileCta = screen.getByTestId('guest-booking-whatsapp-cta-mobile') as HTMLAnchorElement;
    expect(mobileCta).toBeInTheDocument();
    expect(mobileCta.href).toContain('wa.me/919876543210');
    expect(mobileCta.tagName.toLowerCase()).toBe('a');

    // 5. Zero calls to payment gateway.
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('when checkout info has onlinePaymentsAvailable: false with direct phone contact only (no WhatsApp), shows phone fallback', async () => {
    ctx.info = baseInfo({
      onlinePaymentsAvailable: false,
      hostWhatsAppDigits: null,
      hostPhoneDigits: '919123456780',
    });
    ctx.tenant.whatsappBookingPhone = undefined;

    await renderPage();

    // No dead Pay button
    expect(screen.queryByTestId('guest-booking-submit')).toBeNull();

    // Displays direct phone fallback
    const phoneCta = screen.getByTestId('guest-booking-phone-cta') as HTMLAnchorElement;
    expect(phoneCta).toBeInTheDocument();
    expect(phoneCta.href).toBe('tel:+919123456780');
    expect(phoneCta.textContent).toMatch(/Contact Host|Request to Book/i);

    // Mobile bar also has active phone link
    const mobilePhoneCta = screen.getByTestId('guest-booking-phone-cta-mobile') as HTMLAnchorElement;
    expect(mobilePhoneCta).toBeInTheDocument();
    expect(mobilePhoneCta.href).toBe('tel:+919123456780');
  });

  it('without checkout info, the call link dials the site host own profile phone (legalContactPack.contactPhone), country code added', async () => {
    // Checkout info could not be loaded, and the site tenant has no WhatsApp booking number and no payment provider: the only
    // way to reach the host is the phone they entered in their profile. TenantInfo has no top-level `phone`.
    ctx.info = null;
    ctx.tenant.bookingMode = 'WHATSAPP';
    ctx.tenant.paymentProvider = undefined;
    ctx.tenant.whatsappBookingPhone = undefined;
    ctx.tenant.legalContactPack = { contactPhone: '91234 56780' };

    await renderPage();

    expect(screen.queryByTestId('guest-booking-submit')).toBeNull();
    expect(screen.queryByTestId('guest-booking-whatsapp-cta')).toBeNull();
    const phoneCta = screen.getByTestId('guest-booking-phone-cta') as HTMLAnchorElement;
    expect(phoneCta.href).toBe('tel:+919123456780');
  });

  it('without checkout info and without any host phone, shows no call link', async () => {
    ctx.info = null;
    ctx.tenant.bookingMode = 'WHATSAPP';
    ctx.tenant.paymentProvider = undefined;
    ctx.tenant.whatsappBookingPhone = undefined;
    ctx.tenant.legalContactPack = undefined;

    await renderPage();

    expect(screen.queryByTestId('guest-booking-phone-cta')).toBeNull();
    expect(screen.queryByTestId('guest-booking-whatsapp-cta')).toBeNull();
  });

  it('when order creation returns 422 PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT, gracefully recovers to fallback button', async () => {
    ctx.info = baseInfo({
      onlinePaymentsAvailable: true, // initially looked payable
      hostWhatsAppDigits: '919876543210',
    });

    vi.spyOn(axios, 'post').mockRejectedValue(
      new AxiosError('Tenant has no active payment provider', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 422,
        statusText: 'Unprocessable Entity',
        data: {
          code: 'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT',
          message: 'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT: Tenant 109 has no active payment provider.',
        },
        headers: {},
        config: {} as any,
      }),
    );

    await renderPage();

    // Fill form details and consents
    fireEvent.change(screen.getByTestId('guest-booking-name'), { target: { value: 'Guest Traveler' } });
    fireEvent.change(screen.getByTestId('guest-booking-phone'), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByTestId('guest-booking-email'), { target: { value: 'guest@example.com' } });
    fireEvent.click(screen.getByTestId('guest-booking-consent'));

    // Submit was available
    const payBtn = screen.getByTestId('guest-booking-submit');
    expect(payBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(payBtn);
    });
    await settle();
    await settle();

    // The failing Pay button is GONE, replaced by the graceful WhatsApp fallback
    expect(screen.queryByTestId('guest-booking-submit')).toBeNull();
    expect(screen.getByTestId('guest-booking-offline-notice')).toBeInTheDocument();
    const cta = screen.getByTestId('guest-booking-whatsapp-cta') as HTMLAnchorElement;
    expect(cta).toBeInTheDocument();
    expect(cta.href).toContain('wa.me/919876543210');
    expect(cta.textContent).toMatch(/Contact Host via WhatsApp/i);

    // No dead validation error message left on screen
    expect(screen.queryByText(/Validation error:/i)).toBeNull();
  });

  it('when host has no contact numbers at all, displays active Request to Book fallback, never a dead disabled button', async () => {
    ctx.info = baseInfo({
      onlinePaymentsAvailable: false,
      hostWhatsAppDigits: null,
      hostPhoneDigits: null,
    });
    ctx.tenant.whatsappBookingPhone = undefined;

    await renderPage();

    // Desktop shows fallback Request to Book
    const reqCta = screen.getByTestId('guest-booking-request-cta');
    expect(reqCta).toBeInTheDocument();
    expect(reqCta.tagName.toLowerCase()).toBe('a');

    // Mobile shows active link, NOT disabled button
    const mobileCta = screen.getByTestId('guest-booking-no-host-number-mobile');
    expect(mobileCta).toBeInTheDocument();
    expect(mobileCta.tagName.toLowerCase()).toBe('a');
    expect(mobileCta).not.toBeDisabled();
  });
});
