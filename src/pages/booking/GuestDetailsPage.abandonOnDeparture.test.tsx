/**
 * TASK-8219: a guest who leaves /details by browser Back, mobile swipe-back, or tab-close
 * must still release their payment hold — abandonPaymentPendingCheckout must fire exactly
 * once per departure, whichever of the new automatic triggers (pagehide, the debounced
 * visibilitychange fallback, or the in-SPA unmount guard) observes it. A duplicate
 * abandon-checkout POST on a live hold is its own defect, so these tests pin idempotency
 * across every combination, not just that a call happens.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingProvider } from '@/contexts/BookingContext';
import GuestDetailsPage from './GuestDetailsPage';

// jsdom doesn't implement scrollIntoView (used by the page's focus-first-error handler)
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const CHECKOUT_HOLD_KEY = 'atlas_guest_checkout_hold';
const fetchMock = vi.fn();

function seedActiveHold() {
  window.sessionStorage.setItem(
    CHECKOUT_HOLD_KEY,
    JSON.stringify({
      holdId: 42,
      holdToken: 'hold-token-42',
      holdExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      holdPropertySlug: 'atlas-prop',
      holdUnitSlug: 'atlas-unit',
      holdListingName: 'Atlas Unit',
      checkIn: '2026-08-01',
      checkOut: '2026-08-03',
      guests: 2,
    }),
  );
}

async function renderPage() {
  const result = render(
    <MemoryRouter initialEntries={['/homes/atlas-prop/atlas-unit/checkout']}>
      <BookingProvider>
        <GuestDetailsPage />
      </BookingProvider>
    </MemoryRouter>,
  );
  await waitFor(() => expect(document.getElementById('gd-details-form')).toBeInTheDocument());
  return result;
}

function abandonCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('/abandon-checkout'));
}

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  window.sessionStorage.clear();
  seedActiveHold();
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('GuestDetailsPage TASK-8219 abandon-on-departure', () => {
  it('fires one abandon-checkout POST for the live hold on pagehide', async () => {
    await renderPage();

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    await waitFor(() => expect(abandonCalls().length).toBe(1));
    const [url] = abandonCalls()[0]!;
    expect(String(url)).toContain('/bookings/42/abandon-checkout');
    expect(String(url)).toContain('t=hold-token-42');
  });

  it('does not double-fire when the component then unmounts (same departure, two listeners)', async () => {
    const { unmount } = await renderPage();

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await waitFor(() => expect(abandonCalls().length).toBe(1));

    unmount();

    expect(abandonCalls().length).toBe(1);
  });

  it('fires exactly once on unmount alone (in-SPA browser Back with no pagehide)', async () => {
    const { unmount } = await renderPage();

    unmount();

    expect(abandonCalls().length).toBe(1);
  });

  it('does not fire twice if pagehide fires again after the first one already abandoned the hold', async () => {
    await renderPage();

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
      window.dispatchEvent(new Event('pagehide'));
    });

    await waitFor(() => expect(abandonCalls().length).toBe(1));
  });

  it('debounces visibilitychange so a quick tab switch does not abandon the hold', async () => {
    await renderPage();
    // Fake timers only after render/hydration settles under real timers — waitFor's internal
    // polling never fires under fake timers, so switching earlier hangs the test.
    vi.useFakeTimers();

    act(() => {
      setVisibility('hidden');
    });
    act(() => {
      vi.advanceTimersByTime(1000); // well under the debounce window
      setVisibility('visible'); // guest switches straight back
      vi.advanceTimersByTime(5000);
    });

    expect(abandonCalls().length).toBe(0);
  });

  it('abandons the hold once the page stays hidden past the debounce window', async () => {
    await renderPage();
    // Fake timers only after render/hydration settles under real timers (see note above).
    vi.useFakeTimers();

    act(() => {
      setVisibility('hidden');
      vi.advanceTimersByTime(3100);
    });

    expect(abandonCalls().length).toBe(1);
  });
});
