import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { settle } from '../../test/settle';

/**
 * AGT-003: a checkout link's ?promo= code that validates for this listing shows ONE plain line by the price.
 * Nothing else on the page is computed from it. No ?promo= (or an invalid one) shows nothing.
 */

const mocks = vi.hoisted(() => ({
  fetchCalendarPricing: vi.fn(),
  fetchGuestPriceBreakdown: vi.fn(),
  booking: { checkIn: null as string | null, checkOut: null as string | null, guests: 2 },
  dailyPricing: { baseAmount: 6000, actualPrice: 6000, globalDiscountPercent: 0 } as Record<string, number>,
}));

vi.mock('@/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasRuntimeConfig: () => true,
}));

vi.mock('@/tenant/tenantContext', () => ({
  getTenantContext: () => ({
    slug: 'atlas',
    name: 'Atlastays',
    paymentProvider: 'RAZORPAY',
    bookingMode: 'ONLINE' as const,
  }),
}));

vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `http://localhost:5120${path}`,
  getApiHeaders: () => ({}),
  getOrderRequestHeaders: () => ({}),
}));

vi.mock('@/api/availabilityCalendarClient', () => ({
  dedupedAvailabilityCalendarFetch: async () =>
    new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }),
}));

vi.mock('@/api/pricingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchCalendarPricing: mocks.fetchCalendarPricing,
  fetchGuestPriceBreakdown: mocks.fetchGuestPriceBreakdown,
}));

vi.mock('@/api/listingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchPublicListings: async () => [],
}));

vi.mock('@/contexts/BookingContext', () => ({
  useBooking: () => ({ booking: mocks.booking, updateBooking: vi.fn() }),
}));

vi.mock('@/contexts/ListingPhotosContext', () => ({
  useListingPhotosFromApi: () => ({ getUrlsForListingId: () => undefined }),
}));

vi.mock('@/hooks/useDailyPricingSummary', () => ({
  useDailyPricingSummary: () => ({
    data: null,
    loading: false,
    error: null,
    getListingPricing: () => mocks.dailyPricing,
  }),
}));

vi.mock('@/components/FomoBar', () => ({ default: () => null }));
vi.mock('@/lib/events', () => ({ track: vi.fn() }));
vi.mock('./AtlasBookingCalendar', () => ({ AtlasBookingCalendar: () => null }));


const KEY = 'atlas_guest_promo_code';
const LINK_KEY = 'atlas_guest_promo_from_link';

function mockValidate(result: Record<string, unknown> | null, ok = true) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: unknown) => {
    if (typeof url === 'string' && url.includes('/api/promo-codes/quote')) {
      if (result == null) throw new Error('offline');
      return { ok, json: async () => result } as Response;
    }
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch);
}

async function renderWidget() {
  const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
  await act(async () => {
    render(
      <MemoryRouter>
        <UnitBookingWidget listingId={7} propertyId={3} listingName="Atlas 501 PH" propertySlug="atlas501-ph" unitSlug="ph" />
      </MemoryRouter>,
    );
  });
  await settle();
}

describe('UnitBookingWidget - AGT-003 link offer line', () => {
  beforeEach(() => {
    mocks.fetchGuestPriceBreakdown.mockResolvedValue(null);
    mocks.fetchCalendarPricing.mockResolvedValue({ dateToPrice: new Map(), convenienceFeePercent: 3 });
    window.localStorage.clear();
    mocks.booking.checkIn = '2026-06-10';
    mocks.booking.checkOut = '2026-06-14';
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('shows "Your 15% offer is applied at checkout." when the link code validates, and remembers it as a link code', async () => {
    window.history.pushState({}, '', '/homes/p/u?promo=AI12345678&utm_source=ai');
    const spy = mockValidate({ valid: true, percent: 15, discountAmount: 870, totalReduction: 900, finalAmount: 3579, message: '15% off applied' });
    await renderWidget();
    expect(screen.getByTestId('bw-link-offer-line')).toHaveTextContent('Your 15% offer is applied at checkout.');
    const call = spy.mock.calls.find((c) => String(c[0]).includes('/api/promo-codes/quote'))!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toMatchObject({ code: 'AI12345678', listingId: 7, checkIn: '2026-06-10', checkOut: '2026-06-14', guests: 2 });
    expect(window.localStorage.getItem(KEY)).toBe('AI12345678');
    expect(window.localStorage.getItem(LINK_KEY)).toBe('AI12345678');
  });

  it('shows nothing when the code is invalid for this listing', async () => {
    window.history.pushState({}, '', '/homes/p/u?promo=AI12345678');
    mockValidate({ valid: false, message: 'Promo code is not valid for this listing.' });
    await renderWidget();
    expect(screen.queryByTestId('bw-link-offer-line')).toBeNull();
  });

  it('shows nothing when the check fails (offline)', async () => {
    window.history.pushState({}, '', '/homes/p/u?promo=AI12345678');
    mockValidate(null);
    await renderWidget();
    expect(screen.queryByTestId('bw-link-offer-line')).toBeNull();
  });

  it('makes no promo call and shows no line without ?promo=', async () => {
    window.history.pushState({}, '', '/homes/p/u?checkIn=2026-06-10');
    const spy = mockValidate({ valid: true, percent: 15, message: 'x' });
    await renderWidget();
    expect(screen.queryByTestId('bw-link-offer-line')).toBeNull();
    expect(spy.mock.calls.some((c) => String(c[0]).includes('/api/promo-codes/quote'))).toBe(false);
  });
});
