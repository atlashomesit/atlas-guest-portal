/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
});
