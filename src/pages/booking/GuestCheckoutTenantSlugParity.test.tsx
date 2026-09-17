import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { addDays, nextFriday } from 'date-fns';
import { BookingProvider } from '@/contexts/BookingContext';
import UnitBookingWidget from '@/components/availability/UnitBookingWidget';
import GuestDetailsPage from './GuestDetailsPage';
import { toISODate } from '@/utils/dateRange';
import { getIstStartOfDay } from '@/utils/date';

// TASK-102017: Proving integration test that widget -> details navigation on a ?tenant= URL
// carries the host tenant in both the route query string and BookingContext, ensuring that
// POST /api/Razorpay/order (final-charge) sends the matching X-Tenant-Slug rather than 422ing
// against the marketplace apex tenant ('atlas').

window.HTMLElement.prototype.scrollIntoView = vi.fn();

const pricingMock = vi.hoisted(() => ({
  fetchCalendarPricing: vi.fn(),
  fetchGuestGstBreakdown: vi.fn(),
}));

vi.mock('@/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasRuntimeConfig: () => true,
  getRuntimeConfig: () => ({ apiBaseUrl: 'http://localhost:5120' }),
}));

vi.mock('@/tenant/tenantContext', () => ({
  getTenantContext: () => ({
    slug: 'atlas',
    name: 'Atlastays',
    paymentProvider: 'RAZORPAY',
    bookingMode: 'ONLINE' as const,
  }),
}));

vi.mock('@/api/availabilityCalendarClient', () => ({
  dedupedAvailabilityCalendarFetch: vi.fn().mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }))
  ),
}));

vi.mock('@/api/pricingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchCalendarPricing: pricingMock.fetchCalendarPricing,
  fetchGuestGstBreakdown: pricingMock.fetchGuestGstBreakdown,
}));

vi.mock('@/api/listingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchPublicListings: async () => [],
}));

vi.mock('@/contexts/ListingPhotosContext', () => ({
  useListingPhotosFromApi: () => ({ getUrlsForListingId: () => undefined }),
}));

vi.mock('@/hooks/useDailyPricingSummary', () => ({
  useDailyPricingSummary: () => ({
    data: null,
    loading: false,
    error: null,
    getListingPricing: () => ({ baseAmount: 7000, actualPrice: 7000, globalDiscountPercent: 0 }),
  }),
}));

vi.mock('@/components/FomoBar', () => ({ default: () => null }));
vi.mock('@/lib/events', () => ({ track: vi.fn(), TerminalCheckoutOutcomeEvents: {} }));
vi.mock('@/components/availability/AtlasBookingCalendar', () => ({ AtlasBookingCalendar: () => null }));

describe('TASK-102017: Guest checkout carries ?tenant= through storefront to details and final-charge', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    pricingMock.fetchCalendarPricing.mockReset();
    pricingMock.fetchGuestGstBreakdown.mockReset();

    class MockRazorpay {
      open = vi.fn();
      on = vi.fn();
    }
    window.Razorpay = MockRazorpay as unknown as typeof window.Razorpay;

    // Provide default fetch for add-ons, etc.
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }))
    ));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('drives widget -> details navigation on a ?tenant= URL and asserts the final-charge header matches the hold tenant', async () => {
    const tenantSlug = 'qa-bot-c59de6';
    const propertySlug = 'qa-bot-c59de6-homestay';
    const unitSlug = '637';
    const initialUrl = `/homes/${propertySlug}/${unitSlug}?tenant=${tenantSlug}`;

    delete (window as { location?: unknown }).location;
    window.location = new URL(`https://qa.atlashomestays.com${initialUrl}`) as unknown as Location;

    const friday = getIstStartOfDay(nextFriday(addDays(new Date(), 14)));
    const sunday = addDays(friday, 2);
    const fridayISO = toISODate(friday);
    const sundayISO = toISODate(sunday);

    // Pre-seed search state in localStorage so BookingProvider initializes checkIn/checkOut
    window.localStorage.setItem(
      'atlasHeroSearch',
      JSON.stringify({
        checkIn: fridayISO,
        checkOut: sundayISO,
        guests: 2,
      }),
    );

    pricingMock.fetchCalendarPricing.mockResolvedValue({
      dateToPrice: new Map([[fridayISO, 3500], [toISODate(addDays(friday, 1)), 3500]]),
      convenienceFeePercent: 3,
    });
    pricingMock.fetchGuestGstBreakdown.mockResolvedValue({ gstPercent: 0, gstAmount: 0, finalAmount: 7210 });

    const postSpy = vi.spyOn(axios, 'post');

    // 1. Init-hold and final-charge handling
    postSpy.mockImplementation(async (url, body) => {
      const u = String(url);
      if (u.includes('/api/Razorpay/order')) {
        const payload = body as { holdId?: number; guestInfo?: unknown };
        if (!payload?.guestInfo) {
          // Init-hold response
          return {
            data: {
              holdId: 59514,
              holdExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
              prepToken: 'prep-token-59514',
              baseAmount: 7000,
              convenienceFeeAmount: 210,
              finalAmount: 7210,
            },
          };
        }
        // Final-charge response
        return {
          data: {
            keyId: 'rzp_test_sample',
            orderId: 'order_sample_123',
            bookingId: 59514,
            bookingToken: 'token_sample_123',
            amount: 7210,
          },
        };
      }
      return { data: {} };
    });

    render(
      <BookingProvider>
        <MemoryRouter initialEntries={[initialUrl]}>
          <Routes>
            <Route
              path="/homes/:propertySlug/:unitSlug"
              element={
                <UnitBookingWidget
                  listingId={637}
                  propertyId={100}
                  listingName="Sample QA Homestay"
                  propertySlug={propertySlug}
                  unitSlug={unitSlug}
                />
              }
            />
            <Route
              path="/book/:propertySlug/:unitSlug/details"
              element={<GuestDetailsPage />}
            />
          </Routes>
        </MemoryRouter>
      </BookingProvider>,
    );

    // Reserve button in widget
    const reserveButton = await screen.findByTestId('guest-booking-submit');
    await waitFor(() => expect(reserveButton).toBeEnabled());

    await act(async () => {
      fireEvent.click(reserveButton);
    });

    // 1. Assert init-hold call occurred and sent X-Tenant-Slug: qa-bot-c59de6
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    const initHoldHeaders = postSpy.mock.calls[0][2]?.headers as Record<string, string>;
    expect(initHoldHeaders['X-Tenant-Slug']).toBe(tenantSlug);

    // 2. Assert navigation transitioned to GuestDetailsPage
    await waitFor(() => expect(screen.getByTestId('guest-booking-name')).toBeInTheDocument());

    // Fill in guest details
    fireEvent.change(screen.getByTestId('guest-booking-name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByTestId('guest-booking-email'), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByTestId('guest-booking-phone'), { target: { value: '9876543210' } });

    // Accept consent
    const consentBox = screen.getByTestId('guest-booking-consent');
    fireEvent.click(consentBox);

    // Submit Pay
    const payButton = screen.getByTestId('guest-booking-submit');
    await act(async () => {
      fireEvent.click(payButton);
    });

    // 3. Assert final-charge call occurred and ALSO sent X-Tenant-Slug: qa-bot-c59de6!
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(2));
    const finalChargeHeaders = postSpy.mock.calls[1][2]?.headers as Record<string, string>;
    expect(finalChargeHeaders['X-Tenant-Slug']).toBe(tenantSlug);
  });

  it('preserves tenant slug on final-charge even if details page URL query string is missing but BookingContext holds it', async () => {
    const tenantSlug = 'qa-bot-c59de6';

    // Simulate location on /book/.../details WITHOUT ?tenant= in query string
    delete (window as { location?: unknown }).location;
    window.location = new URL('https://qa.atlashomestays.com/book/qa-prop/unit-1/details') as unknown as Location;

    // Seed active hold in sessionStorage with holdTenantSlug
    window.sessionStorage.setItem(
      'atlas_guest_checkout_hold',
      JSON.stringify({
        holdId: 59514,
        holdToken: 'prep-token-59514',
        holdExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        holdPropertySlug: 'qa-prop',
        holdUnitSlug: 'unit-1',
        holdTenantSlug: tenantSlug,
        holdListingName: 'QA Unit',
        holdListingId: 637,
        holdPriceBreakdown: {
          baseAmount: 7000,
          discountAmount: 0,
          convenienceFeeAmount: 210,
          finalAmount: 7210,
          nights: 2,
          currency: 'INR',
        },
        checkIn: '2026-10-01',
        checkOut: '2026-10-03',
        guests: 2,
      }),
    );

    const postSpy = vi.spyOn(axios, 'post').mockResolvedValue({
      data: {
        keyId: 'rzp_test_sample',
        orderId: 'order_sample_123',
        bookingId: 59514,
        bookingToken: 'token_sample_123',
        amount: 7210,
      },
    });

    render(
      <BookingProvider>
        <MemoryRouter initialEntries={['/book/qa-prop/unit-1/details']}>
          <Routes>
            <Route path="/book/:propertySlug/:unitSlug/details" element={<GuestDetailsPage />} />
          </Routes>
        </MemoryRouter>
      </BookingProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('guest-booking-name')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('guest-booking-name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByTestId('guest-booking-email'), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByTestId('guest-booking-phone'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByTestId('guest-booking-consent'));

    const payButton = screen.getByTestId('guest-booking-submit');
    await act(async () => {
      fireEvent.click(payButton);
    });

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    const finalChargeHeaders = postSpy.mock.calls[0][2]?.headers as Record<string, string>;
    expect(finalChargeHeaders['X-Tenant-Slug']).toBe(tenantSlug);
  });
});
