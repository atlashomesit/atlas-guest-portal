/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { addDays, format } from 'date-fns';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getIstCalendarDate } from '@/utils/date';
import EmbedPage, { readableCtaText } from './EmbedPage';

vi.mock('@/runtime-config', () => ({ getApiBaseUrl: () => 'https://api.example.test' }));
vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `https://api.example.test${path}`,
  getApiHeaders: () => ({}),
  getOrderRequestHeaders: () => ({}),
}));

const renderEmbed = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/embed/:embedKey" element={<EmbedPage />} /></Routes>
  </MemoryRouter>,
);

const singleListingConfig = JSON.stringify({
  tenantId: 1, tenantSlug: 'test', tenantName: 'Test',
  isLiveEligible: true, publishedListingsCount: 1,
  listings: [{ id: 1, name: 'Studio', propertyId: 1, propertyName: 'Beach House', maxGuests: 4, baseNightlyRate: 5000 }],
});

// Stubs `fetch` to route the embed config request and the availability-calendar request to
// different canned responses/behaviour, keyed off the request URL -- both land on the global
// `fetch` EmbedPage.tsx calls directly (see fetchAvailability).
function stubEmbedFetch(availability: (url: string) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/availability-calendar')) return availability(url);
    return new Response(singleListingConfig, { status: 200 });
  }));
}

describe('EmbedPage state semantics', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('announces loading state', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderEmbed('/embed/demo');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('announces API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })));
    renderEmbed('/embed/failing');
    expect(await screen.findByRole('alert')).toHaveTextContent('Booking widget unavailable');
  });

  it('shows not-eligible state when isLiveEligible is false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      tenantId: 1, tenantSlug: 'test', tenantName: 'Test',
      isLiveEligible: false, publishedListingsCount: 0, listings: [],
    }), { status: 200 })));
    renderEmbed('/embed/demo');
    expect(await screen.findByTestId('embed-not-eligible')).toBeInTheDocument();
  });

  it('shows no-listings state when listings array is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      tenantId: 1, tenantSlug: 'test', tenantName: 'Test',
      isLiveEligible: true, publishedListingsCount: 0, listings: [],
    }), { status: 200 })));
    renderEmbed('/embed/demo');
    expect(await screen.findByTestId('embed-no-listings')).toBeInTheDocument();
  });

  it('auto-selects single listing and shows date picker', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      tenantId: 1, tenantSlug: 'test', tenantName: 'Test',
      isLiveEligible: true, publishedListingsCount: 1,
      listings: [{ id: 1, name: 'Studio', propertyId: 1, propertyName: 'Beach House', maxGuests: 4, baseNightlyRate: 5000 }],
    }), { status: 200 })));
    renderEmbed('/embed/demo');
    expect(await screen.findByTestId('embed-date-guest')).toBeInTheDocument();
  });

  it('chooses a readable CTA label for light and dark tenant colors', () => {
    expect(readableCtaText('#ffffff')).toBe('#111827');
    expect(readableCtaText('#fff')).toBe('#111827');
    expect(readableCtaText('#0f766e')).toBe('#ffffff');
  });

  // TASK-10168 defect 1: fetchAvailability's resolved Map used to be discarded entirely, so
  // every date in the year was selectable regardless of occupancy.
  it('does not allow submitting a Blocked night', async () => {
    const today = getIstCalendarDate();
    const checkIn = addDays(today, 1);
    const checkOut = addDays(today, 2); // a single night: checkIn itself
    const blockedNight = format(checkIn, 'yyyy-MM-dd');

    stubEmbedFetch(async () => new Response(
      JSON.stringify([{ date: blockedNight, status: 'Blocked' }]),
      { status: 200 },
    ));

    renderEmbed('/embed/demo');
    await screen.findByTestId('embed-date-guest');

    fireEvent.change(screen.getByTestId('embed-checkin-date'), { target: { value: format(checkIn, 'yyyy-MM-dd') } });
    fireEvent.change(screen.getByTestId('embed-checkout-date'), { target: { value: format(checkOut, 'yyyy-MM-dd') } });

    // findByRole waits out the "Checking availability..." loading label first, so this only
    // passes once the fetch has actually resolved and the range has actually been evaluated --
    // not merely because the button happened to be disabled while still loading.
    const cta = await screen.findByRole('button', { name: 'Check pricing' });
    expect(cta).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/selected nights/);
  });

  // TASK-10168 defect 2: fetchAvailability's own fetch has no .catch, so a rejected promise
  // (DNS/offline/CORS/abort) left `loadingAvail` stuck true and "Check pricing" disabled forever.
  it('leaves the CTA enabled with a retry affordance when the availability fetch fails', async () => {
    let availabilityCalls = 0;
    stubEmbedFetch(async () => { availabilityCalls += 1; throw new TypeError('Failed to fetch'); });

    renderEmbed('/embed/demo');
    const cta = await screen.findByRole('button', { name: 'Retry availability check' });
    expect(cta).not.toBeDisabled();
    expect(availabilityCalls).toBe(1);

    fireEvent.click(cta);
    await waitFor(() => expect(availabilityCalls).toBe(2));
  });
});
