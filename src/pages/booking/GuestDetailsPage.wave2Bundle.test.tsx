import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import axios from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingProvider } from '@/contexts/BookingContext';
import { _setTenantContextForTests } from '@/tenant/tenantContext';
import { _resetTenantResolutionForTests, setMarketplaceMode } from '@/tenant/tenantResolver';
import type { ListingCheckoutInfo } from '@/api/checkoutInfoClient';
import { istInstantFromCalendarDate } from '@/utils/date';
import { settle } from '../../test/settle';
import GuestDetailsPage from './GuestDetailsPage';

vi.mock('@/lib/events', () => ({
  track: vi.fn(),
  TerminalCheckoutOutcomeEvents: {
    PaymentConfirmed: 'payment_confirmed',
    PaymentFailed: 'payment_failed',
    PaymentModalDismissed: 'payment_modal_dismissed',
    ChargedUnconfirmed: 'charged_unconfirmed',
  },
}));

vi.mock('@/api/checkoutInfoClient', () => ({
  fetchListingCheckoutInfo: vi.fn(async (): Promise<ListingCheckoutInfo> => ({
    listingId: 637,
    hostName: 'Comfort Cove',
    hasHouseRules: false,
    houseRulesText: null,
    houseRulesPdfUrl: null,
    houseRulesStructuredJson: null,
    hostWhatsAppDigits: '919876543210',
    hostPhoneDigits: '919876543210',
    bookingMode: 'ONLINE',
    onlinePaymentsAvailable: true,
  })),
}));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

const CHECKOUT_HOLD_KEY = 'atlas_guest_checkout_hold';

describe('Wave 2 GuestDetailsPage bundle (TASK-1040087, GUEST-049, TASK-1040117 / DYN-005)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    _resetTenantResolutionForTests();
    _setTenantContextForTests({
      slug: 'atlas',
      name: 'Atlas Homes',
      bookingMode: 'ONLINE',
      paymentProvider: 'RAZORPAY',
    });

    class MockRazorpay {
      on() {}
      open() {}
    }
    (window as unknown as { Razorpay: unknown }).Razorpay = MockRazorpay;
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    window.localStorage.clear();
    _resetTenantResolutionForTests();
    vi.restoreAllMocks();
  });

  it('TASK-1040087: sends channel=marketplace and bookingSource=marketplace in POST /api/Razorpay/order when arriving via Marketplace', async () => {
    setMarketplaceMode(true);
    window.sessionStorage.setItem(
      CHECKOUT_HOLD_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        holdListingId: 637,
        holdPropertySlug: 'comfort-cove',
        holdUnitSlug: '450',
        holdTenantSlug: 'atlas',
        holdListingName: 'Comfort Cove',
        holdBookingChannel: 'marketplace',
        holdPriceBreakdown: {
          baseAmount: 8000,
          discountAmount: 0,
          convenienceFeeAmount: 240,
          finalAmount: 8240,
          nights: 2,
          currency: 'INR',
        },
        checkIn: istInstantFromCalendarDate(new Date(2026, 9, 20)).toISOString(),
        checkOut: istInstantFromCalendarDate(new Date(2026, 9, 22)).toISOString(),
        guests: 2,
      }),
    );

    const postSpy = vi.spyOn(axios, 'post').mockImplementation((async (_url: string, body: unknown) => {
      const b = body as { guestInfo?: unknown };
      if (!b.guestInfo) {
        return {
          data: {
            holdId: 9101,
            holdExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
            prepToken: 'prep-9101',
            finalAmount: 8240,
          },
        };
      }
      return {
        data: {
          keyId: 'rzp_test_mkt',
          orderId: 'order_mkt_1',
          bookingId: 9101,
          bookingToken: 'tok_mkt_1',
          amount: 8240,
        },
      };
    }) as never);

    render(
      <MemoryRouter initialEntries={['/book/comfort-cove/450/details?tenant=atlas&brand=atlastays']}>
        <BookingProvider>
          <Routes>
            <Route path="/book/:propertySlug/:unitSlug/details" element={<GuestDetailsPage />} />
          </Routes>
        </BookingProvider>
      </MemoryRouter>,
    );

    await settle();
    await settle();

    fireEvent.change(screen.getByTestId('guest-booking-name'), { target: { value: 'Riya Sharma' } });
    fireEvent.change(screen.getByTestId('guest-booking-email'), { target: { value: 'riya@example.com' } });
    fireEvent.change(screen.getByTestId('guest-booking-phone'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByTestId('guest-booking-consent'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();

    expect(postSpy).toHaveBeenCalledTimes(2);
    const initHoldBody = postSpy.mock.calls[0][1] as Record<string, unknown>;
    const finalOrderBody = postSpy.mock.calls[1][1] as Record<string, unknown>;

    expect(initHoldBody.channel).toBe('marketplace');
    expect(initHoldBody.bookingSource).toBe('marketplace');
    expect((initHoldBody.bookingDraft as Record<string, unknown>).channel).toBe('marketplace');
    expect((initHoldBody.bookingDraft as Record<string, unknown>).bookingSource).toBe('marketplace');

    expect(finalOrderBody.channel).toBe('marketplace');
    expect(finalOrderBody.bookingSource).toBe('marketplace');
    expect((finalOrderBody.bookingDraft as Record<string, unknown>).channel).toBe('marketplace');
    expect((finalOrderBody.bookingDraft as Record<string, unknown>).bookingSource).toBe('marketplace');
  });

  it('TASK-1040087: omits marketplace channel/bookingSource on direct host storefront checkout even when ?tenant= is present', async () => {
    _resetTenantResolutionForTests();
    window.sessionStorage.setItem(
      CHECKOUT_HOLD_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        holdListingId: 637,
        holdPropertySlug: 'grove-co',
        holdUnitSlug: 'penthouse',
        holdTenantSlug: 'grove-and-co',
        holdListingName: 'Penthouse',
        holdPriceBreakdown: {
          baseAmount: 8000,
          discountAmount: 0,
          convenienceFeeAmount: 240,
          finalAmount: 8240,
          nights: 2,
          currency: 'INR',
        },
        checkIn: istInstantFromCalendarDate(new Date(2026, 9, 20)).toISOString(),
        checkOut: istInstantFromCalendarDate(new Date(2026, 9, 22)).toISOString(),
        guests: 2,
      }),
    );

    const postSpy = vi.spyOn(axios, 'post').mockImplementation((async (_url: string, body: unknown) => {
      const b = body as { guestInfo?: unknown };
      if (!b.guestInfo) {
        return {
          data: {
            holdId: 9102,
            holdExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
            prepToken: 'prep-9102',
            finalAmount: 8240,
          },
        };
      }
      return {
        data: {
          keyId: 'rzp_test_dir',
          orderId: 'order_dir_1',
          bookingId: 9102,
          bookingToken: 'tok_dir_1',
          amount: 8240,
        },
      };
    }) as never);

    render(
      <MemoryRouter initialEntries={['/book/grove-co/penthouse/details?tenant=grove-and-co']}>
        <BookingProvider>
          <Routes>
            <Route path="/book/:propertySlug/:unitSlug/details" element={<GuestDetailsPage />} />
          </Routes>
        </BookingProvider>
      </MemoryRouter>,
    );

    await settle();
    await settle();

    fireEvent.change(screen.getByTestId('guest-booking-name'), { target: { value: 'Riya Sharma' } });
    fireEvent.change(screen.getByTestId('guest-booking-email'), { target: { value: 'riya@example.com' } });
    fireEvent.change(screen.getByTestId('guest-booking-phone'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByTestId('guest-booking-consent'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('guest-booking-submit'));
    });
    await settle();

    expect(postSpy).toHaveBeenCalledTimes(2);
    const initHoldBody = postSpy.mock.calls[0][1] as Record<string, unknown>;
    const finalOrderBody = postSpy.mock.calls[1][1] as Record<string, unknown>;

    expect(initHoldBody.channel).toBeUndefined();
    expect(initHoldBody.bookingSource).toBeUndefined();
    expect((initHoldBody.bookingDraft as Record<string, unknown>).channel).toBeUndefined();
    expect(finalOrderBody.channel).toBeUndefined();
    expect(finalOrderBody.bookingSource).toBeUndefined();
    expect((finalOrderBody.bookingDraft as Record<string, unknown>).channel).toBeUndefined();
  });

  it('GUEST-049: renders itemized Cleaning fee, Extra guest fee, and Weekend rate adjustment without ever showing "Other charges"', async () => {
    window.sessionStorage.setItem(
      CHECKOUT_HOLD_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        holdListingId: 637,
        holdPropertySlug: 'comfort-cove',
        holdUnitSlug: '450',
        holdTenantSlug: 'atlas',
        holdListingName: 'Comfort Cove',
        // Base 6000 + Cleaning 800 + Extra guest 600 + Weekend adjustment 500 + Fee 237 = 8137
        // (Weekend adjustment 500 comes via negative variance across Friday night 2026-10-23 -> 2026-10-25)
        holdPriceBreakdown: {
          baseAmount: 6000,
          discountAmount: 0,
          cleaningFee: 800,
          extraGuestFee: 600,
          convenienceFeeAmount: 237,
          finalAmount: 8137,
          nights: 2,
          currency: 'INR',
        },
        checkIn: istInstantFromCalendarDate(new Date(2026, 9, 23)).toISOString(), // Friday
        checkOut: istInstantFromCalendarDate(new Date(2026, 9, 25)).toISOString(), // Sunday
        guests: 4,
      }),
    );

    const view = render(
      <MemoryRouter initialEntries={['/book/comfort-cove/450/details']}>
        <BookingProvider>
          <GuestDetailsPage />
        </BookingProvider>
      </MemoryRouter>,
    );

    await settle();

    expect(screen.getByTestId('cleaning-fee-row').textContent).toContain('Cleaning fee');
    expect(screen.getByTestId('cleaning-fee-row').textContent).toContain('800');
    expect(screen.getByTestId('extra-guest-fee-row').textContent).toContain('Extra guest fee (4 guests)');
    expect(screen.getByTestId('extra-guest-fee-row').textContent).toContain('600');
    expect(screen.getByTestId('weekend-adjustment-row').textContent).toContain('Weekend rate adjustment');
    expect(screen.getByTestId('weekend-adjustment-row').textContent).toContain('500');
    expect(screen.queryByTestId('price-line-discount-plug')).not.toBeInTheDocument();
    expect(view.container.textContent).not.toContain('Other charges');
    expect(view.container.querySelector('.gd-price-total .num')?.textContent).toContain('8,137');
  });

  it('GUEST-049: reconciles unitemized midweek server variance into base accommodation rate with tooltip and logs console.warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    window.sessionStorage.setItem(
      CHECKOUT_HOLD_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        holdListingId: 637,
        holdPropertySlug: 'comfort-cove',
        holdUnitSlug: '450',
        holdTenantSlug: 'atlas',
        holdListingName: 'Comfort Cove',
        // Midweek Tuesday -> Thursday: base 6000 + fee 200 = 6200 vs server finalAmount 6600 (+400 variance)
        holdPriceBreakdown: {
          baseAmount: 6000,
          discountAmount: 0,
          convenienceFeeAmount: 200,
          finalAmount: 6600,
          nights: 2,
          currency: 'INR',
        },
        checkIn: istInstantFromCalendarDate(new Date(2026, 9, 20)).toISOString(), // Tuesday
        checkOut: istInstantFromCalendarDate(new Date(2026, 9, 22)).toISOString(), // Thursday
        guests: 2,
      }),
    );

    const view = render(
      <MemoryRouter initialEntries={['/book/comfort-cove/450/details']}>
        <BookingProvider>
          <GuestDetailsPage />
        </BookingProvider>
      </MemoryRouter>,
    );

    await settle();

    expect(screen.getByTestId('price-line-base').textContent).toContain('3,200 × 2 nights');
    expect(screen.getByTestId('price-line-base').textContent).toContain('6,400');
    expect(screen.getByTestId('fee-info-rate-adjustment')).toBeInTheDocument();
    expect(view.container.textContent).not.toContain('Other charges');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('TASK-1040117 / DYN-005: renders strike-through original nightly rate and deal badge ONLY when genuine server discount data exists', async () => {
    window.sessionStorage.setItem(
      CHECKOUT_HOLD_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        holdListingId: 637,
        holdPropertySlug: 'comfort-cove',
        holdUnitSlug: '450',
        holdTenantSlug: 'atlas',
        holdListingName: 'Comfort Cove',
        holdPriceBreakdown: {
          baseAmount: 8000,
          discountAmount: 0,
          convenienceFeeAmount: 240,
          finalAmount: 8240,
          nights: 2,
          currency: 'INR',
          originalNightlyRate: 5000,
          discountedNightlyRate: 4000,
          appliedPromotionLabel: 'Early Bird 20% off',
        },
        checkIn: istInstantFromCalendarDate(new Date(2026, 9, 20)).toISOString(),
        checkOut: istInstantFromCalendarDate(new Date(2026, 9, 22)).toISOString(),
        guests: 2,
      }),
    );

    const { unmount } = render(
      <MemoryRouter initialEntries={['/book/comfort-cove/450/details']}>
        <BookingProvider>
          <GuestDetailsPage />
        </BookingProvider>
      </MemoryRouter>,
    );

    await settle();

    expect(screen.getByTestId('checkout-original-nightly-rate').textContent).toContain('5,000');
    expect(screen.getByTestId('checkout-deal-badge').textContent).toBe('Early Bird 20% off');
    expect(screen.getByTestId('price-line-base').textContent).toContain('4,000 × 2 nights');

    unmount();
    window.sessionStorage.clear();

    // Undiscounted quote => ZERO strike-through or fake deal badge
    window.sessionStorage.setItem(
      CHECKOUT_HOLD_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        holdListingId: 637,
        holdPropertySlug: 'comfort-cove',
        holdUnitSlug: '450',
        holdTenantSlug: 'atlas',
        holdListingName: 'Comfort Cove',
        holdPriceBreakdown: {
          baseAmount: 8000,
          discountAmount: 0,
          convenienceFeeAmount: 240,
          finalAmount: 8240,
          nights: 2,
          currency: 'INR',
        },
        checkIn: istInstantFromCalendarDate(new Date(2026, 9, 20)).toISOString(),
        checkOut: istInstantFromCalendarDate(new Date(2026, 9, 22)).toISOString(),
        guests: 2,
      }),
    );

    render(
      <MemoryRouter initialEntries={['/book/comfort-cove/450/details']}>
        <BookingProvider>
          <GuestDetailsPage />
        </BookingProvider>
      </MemoryRouter>,
    );

    await settle();

    expect(screen.queryByTestId('checkout-original-nightly-rate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkout-deal-badge')).not.toBeInTheDocument();
  });
});
