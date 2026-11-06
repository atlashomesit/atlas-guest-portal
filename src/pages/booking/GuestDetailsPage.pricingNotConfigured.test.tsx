import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingProvider } from '@/contexts/BookingContext';
import { settle } from '@/test/settle';
import GuestDetailsPage from './GuestDetailsPage';

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('@/api/pricingClient', async () => {
  const { PricingNotConfiguredError } = await import('@/utils/pricingNotConfigured');
  return {
    fetchGuestPriceBreakdown: vi.fn(async () => {
      throw new PricingNotConfiguredError("This room can't be booked online yet. Please contact the host.");
    }),
  };
});

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
  getTenantContext: () => ({
    slug: 'atlas',
    name: 'Atlas Homes',
    paymentProvider: 'RAZORPAY',
    bookingMode: 'ONLINE',
  }),
}));

vi.mock('@/api/checkoutInfoClient', () => ({
  fetchListingCheckoutInfo: vi.fn(async () => ({
    listingId: 101,
    hostName: 'Test Host',
    houseRules: [],
  })),
}));

vi.mock('@/api/listingClient', () => ({
  fetchListingById: vi.fn(async () => ({
    id: 101,
    name: 'Seaside Villa',
    photoUrls: [],
  })),
}));

vi.mock('@/utils/listingResolver', () => ({
  resolveListing: vi.fn(async () => ({
    id: 101,
    name: 'Seaside Villa',
  })),
}));

describe('GuestDetailsPage - TASK-1040051: a stay the API refuses to price has no total and no Pay', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('on a deep link whose guest-breakdown answers 409 PRICING_NOT_CONFIGURED: the API sentence, no INR 1, Pay disabled', async () => {
    const initialUrl = '/book/qa-bot/1515/details?checkIn=2026-12-10&checkOut=2026-12-12&guests=2&tenant=qa-bot';

    render(
      <BookingProvider>
        <MemoryRouter initialEntries={[initialUrl]}>
          <Routes>
            <Route path="/book/:propertySlug/:unitSlug/details" element={<GuestDetailsPage />} />
          </Routes>
        </MemoryRouter>
      </BookingProvider>,
    );
    await settle();

    expect(screen.getByTestId('checkout-pricing-not-configured')).toHaveTextContent("This room can't be booked online yet");
    expect(screen.getByTestId('guest-booking-submit')).toBeDisabled();
    expect(screen.getByTestId('guest-booking-submit').textContent ?? '').not.toMatch(/\d/);
    expect(screen.getByTestId('checkout-total-amount').textContent ?? '').not.toMatch(/\d/);
    expect(screen.getByTestId('guest-booking-submit-mobile')).toBeDisabled();
  });
});
