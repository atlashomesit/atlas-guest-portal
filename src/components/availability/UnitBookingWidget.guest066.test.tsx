import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { settle } from '../../test/settle';

vi.mock('@/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasRuntimeConfig: () => true,
}));
vi.mock('@/tenant/tenantContext', () => ({
  getTenantContext: () => ({ slug: 'nightnest', name: 'Nightnest', paymentProvider: 'RAZORPAY', bookingMode: 'ONLINE' }),
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
  fetchCalendarPricing: vi.fn(async () => ({ dateToPrice: new Map<string, number>(), convenienceFeePercent: 0 })),
  fetchGuestGstBreakdown: vi.fn(async () => null),
  fetchGuestPriceBreakdown: vi.fn(async () => null),
}));
vi.mock('@/api/listingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchPublicListings: async () => [],
}));
vi.mock('@/contexts/BookingContext', () => ({
  useBooking: () => ({ booking: { checkIn: null, checkOut: null, guests: 1 }, updateBooking: vi.fn() }),
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
vi.mock('@/lib/events', () => ({ track: vi.fn() }));

import UnitBookingWidget from './UnitBookingWidget';

describe('UnitBookingWidget (GUEST-066)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows a capacity mismatch hint for a 4 BHK home capped at 1 guest', async () => {
    render(
      <MemoryRouter>
        <UnitBookingWidget
          listingId={30}
          propertyId={3}
          listingName="Nightnest-4 BHK Homestay"
          maxGuests={1}
          propertySlug="nightnest-4-bhk"
          unitSlug="30"
        />
      </MemoryRouter>,
    );
    await settle();
    expect(screen.getByTestId('bw-capacity-mismatch-hint')).toHaveTextContent(/4-bedroom/);
    expect(screen.getByTestId('bw-capacity-mismatch-hint')).toHaveTextContent(/up to 1 guest/);
  });
});