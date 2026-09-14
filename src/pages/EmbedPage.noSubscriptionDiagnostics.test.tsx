/** @vitest-environment jsdom */

// TASK-101487: GET /api/public/embed/{key}/config is [AllowAnonymous] and the embed key sits in the
// host's public page source, so the API deliberately never sends websiteState/blocker (pinned
// api-side by PublicEmbedConfigNoBillingLeakTests). The widget used to read both anyway and render
// `blocker ?? websiteState` into a hidden node: against the real contract that node always said
// "Unknown", and against any richer payload it put a subscription diagnostic into the guest DOM.

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EmbedPage from './EmbedPage';

vi.mock('@/runtime-config', () => ({ getApiBaseUrl: () => 'https://api.example.test' }));
vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `https://api.example.test${path}`,
  getApiHeaders: () => ({}),
  getOrderRequestHeaders: () => ({}),
}));

const renderEmbed = () => render(
  <MemoryRouter initialEntries={['/embed/demo']}>
    <Routes><Route path="/embed/:embedKey" element={<EmbedPage />} /></Routes>
  </MemoryRouter>,
);

const stubConfig = (body: Record<string, unknown>) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));

const notEligible = {
  tenantId: 1, tenantSlug: 'test', tenantName: 'Test',
  isLiveEligible: false, publishedListingsCount: 0, listings: [],
};

describe('EmbedPage never surfaces subscription diagnostics (TASK-101487)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders no blocker node for the real contract, which omits both fields', async () => {
    stubConfig(notEligible);
    renderEmbed();
    expect(await screen.findByTestId('embed-not-eligible')).toBeInTheDocument();
    expect(screen.queryByTestId('embed-blocker')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Unknown/);
  });

  it('does not echo websiteState/blocker even if a payload carries them', async () => {
    stubConfig({ ...notEligible, websiteState: 'NotActivated', blocker: 'SUBSCRIPTION_LAPSED_GRACE' });
    renderEmbed();
    expect(await screen.findByTestId('embed-not-eligible')).toBeInTheDocument();
    expect(screen.queryByTestId('embed-blocker')).toBeNull();
    expect(document.body.textContent).not.toMatch(/SUBSCRIPTION_LAPSED|NotActivated/);
  });
});
