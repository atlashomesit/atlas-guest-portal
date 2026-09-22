/** @vitest-environment jsdom */

/**
 * TASK-102074: the embed checkout always pays through the Razorpay gateway (no WhatsApp-handoff
 * branch exists here), so the security/encryption trust badges render unconditionally under the
 * "Pay & book" CTA on the guest-details step.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { addDays, format } from 'date-fns';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getIstCalendarDate } from '@/utils/date';
import EmbedPage from './EmbedPage';

vi.mock('@/runtime-config', () => ({ getApiBaseUrl: () => 'https://api.example.test' }));
vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `https://api.example.test${path}`,
  getApiHeaders: () => ({}),
  getOrderRequestHeaders: () => ({}),
}));
vi.mock('@/api/pricingClient', () => ({
  fetchGuestPriceBreakdown: async () => ({
    finalAmount: 5000,
    convenienceFeeAmount: 0,
    gstAmount: 0,
    gstPercent: 0,
    touristTaxAmount: 0,
  }),
  netChargeableRoomFare: () => 5000,
}));

const singleListingConfig = JSON.stringify({
  tenantId: 1, tenantSlug: 'test', tenantName: 'Test',
  isLiveEligible: true, publishedListingsCount: 1,
  listings: [{ id: 1, name: 'Studio', propertyId: 1, propertyName: 'Beach House', maxGuests: 4, baseNightlyRate: 5000 }],
});

const renderEmbed = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/embed/:embedKey" element={<EmbedPage />} /></Routes>
  </MemoryRouter>,
);

function stubEmbedFetch(availability: (url: string) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/availability-calendar')) return availability(url);
    return new Response(singleListingConfig, { status: 200 });
  }));
}

describe('TASK-102074: embed checkout trust badges', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders SSL / RBI gateway / instant-confirmation badges under the Pay & book CTA', async () => {
    const today = getIstCalendarDate();
    const checkIn = addDays(today, 1);
    const checkOut = addDays(today, 2);
    stubEmbedFetch(async () => new Response(
      JSON.stringify([{ date: format(checkIn, 'yyyy-MM-dd'), status: 'Available' }]),
      { status: 200 },
    ));

    renderEmbed('/embed/demo');
    await screen.findByTestId('embed-date-guest');

    fireEvent.change(screen.getByLabelText('Check-in'), { target: { value: format(checkIn, 'yyyy-MM-dd') } });
    fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: format(checkOut, 'yyyy-MM-dd') } });
    fireEvent.click(await screen.findByRole('button', { name: 'Check pricing' }));

    await screen.findByTestId('embed-guest-details');
    expect(screen.getByRole('button', { name: 'Pay & book' })).toBeInTheDocument();

    const badgeRow = screen.getByTestId('embed-trust-badges');
    expect(badgeRow).toHaveTextContent('256-Bit SSL Encrypted');
    expect(badgeRow).toHaveTextContent('RBI-Regulated Gateway');
    expect(badgeRow).toHaveTextContent('Instant Booking Confirmation');
  });
});