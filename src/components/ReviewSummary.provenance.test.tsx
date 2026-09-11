// TASK-10089 — ReviewSummary provenance gating. The sentiment chip is computed
// from native Atlas reviews only, so on marketplace cards it must display only
// when its verified-stay count agrees with the card's provenance. A mismatch
// means card and chip describe different review sets, and the chip hides rather
// than present unverified proof. Surfaces that pass no expectation (listing
// detail pages) and older API payloads without the field keep historical behaviour.
//
// RED before the fix: the component accepts only listingId and renders whenever
// the summary has keywords — agreement is never checked.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/api/client', () => ({
  buildApiUrl: (p: string) => `https://api.test${p}`,
  getApiHeaders: () => ({}),
}));

import ReviewSummary from './ReviewSummary';

const SUMMARY = {
  listingId: 9,
  reviewCount: 3,
  sentiment: 'positive',
  positivePercent: 90,
  topKeywords: ['clean', 'quiet'],
  verifiedStayCount: 1,
  externalReviewCount: 2,
};

function stubSummary(payload: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: status === 200, status, json: async () => payload }) as unknown as Response),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TASK-10089 ReviewSummary provenance gating', () => {
  it('renders the chip when the summary count agrees with the card', async () => {
    stubSummary(SUMMARY);
    render(<ReviewSummary listingId={9} verifiedStayCount={1} />);
    await waitFor(() => expect(screen.getByText(/Mostly positive/)).toBeInTheDocument());
  });

  it('hides the chip when the summary count disagrees with the card', async () => {
    stubSummary(SUMMARY);
    render(<ReviewSummary listingId={9} verifiedStayCount={7} />);
    // Let the fetch resolve; the chip must never appear.
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText(/Mostly positive/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Guests mention/)).not.toBeInTheDocument();
  });

  it('renders as before when the card passes no expectation (listing detail)', async () => {
    stubSummary(SUMMARY);
    render(<ReviewSummary listingId={9} />);
    await waitFor(() => expect(screen.getByText(/Mostly positive/)).toBeInTheDocument());
  });

  it('renders as before against an older API payload without provenance fields', async () => {
    const { verifiedStayCount: _dropped, externalReviewCount: _alsoDropped, ...legacy } = SUMMARY;
    void _dropped;
    void _alsoDropped;
    stubSummary(legacy);
    render(<ReviewSummary listingId={9} verifiedStayCount={1} />);
    await waitFor(() => expect(screen.getByText(/Mostly positive/)).toBeInTheDocument());
  });
});

