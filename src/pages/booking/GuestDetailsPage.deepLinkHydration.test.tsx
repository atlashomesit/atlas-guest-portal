import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingProvider } from '@/contexts/BookingContext';
import GuestDetailsPage from './GuestDetailsPage';

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

describe('GuestDetailsPage deep-link query hydration (TASK-10298987)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('hydrates booking state from URL search params on direct deep-link and avoids stale draft modal', async () => {
    // Direct navigation with checkIn, checkOut, guests search params
    const initialUrl = '/book/seaside-property/101/details?checkIn=2026-11-10&checkOut=2026-11-15&guests=3&tenant=test-tenant';

    render(
      <BookingProvider>
        <MemoryRouter initialEntries={[initialUrl]}>
          <Routes>
            <Route path="/book/:propertySlug/:unitSlug/details" element={<GuestDetailsPage />} />
          </Routes>
        </MemoryRouter>
      </BookingProvider>
    );

    // Should NOT show the stale draft / select stay dates blocking modal
    expect(screen.queryByText(/Let's pick your dates again/i)).toBeNull();
    expect(screen.queryByText(/We couldn't find the stay you were booking/i)).toBeNull();

    // Should render the checkout details form and hydrated dates
    expect(screen.getByText(/Almost there — just your details/i)).toBeDefined();
    expect(screen.getByTestId('booking-recap')).toBeDefined();
    expect(screen.getAllByText(/Tue, 10 Nov, 2026/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sun, 15 Nov, 2026/i).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/As on a government ID/i)).toBeDefined();
  });

  it('shows select your stay dates modal when navigating without dates and no cached hold', async () => {
    // Direct navigation WITHOUT checkIn/checkOut
    const initialUrl = '/book/seaside-property/101/details';

    render(
      <BookingProvider>
        <MemoryRouter initialEntries={[initialUrl]}>
          <Routes>
            <Route path="/book/:propertySlug/:unitSlug/details" element={<GuestDetailsPage />} />
          </Routes>
        </MemoryRouter>
      </BookingProvider>
    );

    // Stale draft blocking modal SHOULD be shown when no dates exist
    expect(screen.getByText(/Let's pick your dates again/i)).toBeDefined();
    expect(screen.getByText(/We couldn't find the stay you were booking/i)).toBeDefined();
  });
});
