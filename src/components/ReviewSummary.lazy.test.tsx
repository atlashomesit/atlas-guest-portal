// TASK-1039954 - ReviewSummary `lazy` mode. A grid of cards must not fire one summary request per card at mount:
// with `lazy` the request waits until the card's sentinel is near the viewport. Without `lazy` (listing detail
// pages) and without IntersectionObserver support (old browsers, jsdom) the component fetches at mount as before.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

vi.mock('@/api/client', () => ({
  buildApiUrl: (p: string) => `https://api.test${p}`,
  getApiHeaders: () => ({}),
}));

import ReviewSummary, { _clearReviewSummaryCacheForTests } from './ReviewSummary';
import { settle } from '../test/settle';

const SUMMARY = {
  listingId: 9,
  reviewCount: 3,
  sentiment: 'positive',
  positivePercent: 90,
  topKeywords: ['clean', 'quiet'],
};

type FakeObserver = { callback: IntersectionObserverCallback; targets: Element[]; disconnected: boolean; options?: IntersectionObserverInit };
let observers: FakeObserver[] = [];

class FakeIntersectionObserver {
  private readonly record: FakeObserver;
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.record = { callback, targets: [], disconnected: false, options };
    observers.push(this.record);
  }
  observe(target: Element) {
    this.record.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    this.record.disconnected = true;
  }
  takeRecords() {
    return [];
  }
}

function reveal(target: Element) {
  for (const o of observers) {
    if (o.targets.includes(target)) {
      o.callback(
        [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
        o as unknown as IntersectionObserver,
      );
    }
  }
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // The 5-minute per-listing cache would otherwise turn every test after the first into a no-fetch run.
  _clearReviewSummaryCacheForTests();
  observers = [];
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => SUMMARY }) as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TASK-1039954 ReviewSummary lazy mode', () => {
  it('lazy: waits for the sentinel to intersect, then fetches once and renders the chip', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    render(<ReviewSummary listingId={9} lazy />);
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    const sentinel = screen.getByTestId('review-summary-sentinel');
    expect(sentinel).toHaveAttribute('aria-hidden', 'true');

    await act(async () => {
      reveal(sentinel);
    });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.test/api/listings/9/reviews/summary');
    expect(screen.getByText(/Mostly positive/)).toBeInTheDocument();
    expect(screen.queryByTestId('review-summary-sentinel')).toBeNull();
    // The observer is released once it has done its one job.
    expect(observers.every((o) => o.disconnected)).toBe(true);
  });

  it('lazy: a card that never nears the viewport never asks', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const { unmount } = render(<ReviewSummary listingId={9} lazy />);
    await settle();
    unmount();
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lazy without IntersectionObserver support: fetches at mount like before', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<ReviewSummary listingId={9} lazy />);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Mostly positive/)).toBeInTheDocument();
  });

  it('not lazy (listing detail page): fetches at mount even when IntersectionObserver exists', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    render(<ReviewSummary listingId={9} />);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('review-summary-sentinel')).toBeNull();
  });
});
