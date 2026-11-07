/**
 * TASK-10299419: the marketplace detail page shows "not taking bookings" only when the API says the listing is hidden by
 * its host's billing (404 LISTING_UNAVAILABLE). A plain 404, a 200 or a failed read never hides a bookable home.
 *
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMarketplaceListingUnavailable } from '../useMarketplaceListingUnavailable';

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMarketplaceListingUnavailable', () => {
  it('is true for 404 LISTING_UNAVAILABLE', async () => {
    const fetchMock = respond(404, { error: 'LISTING_UNAVAILABLE', message: 'This property is not taking bookings right now.' });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useMarketplaceListingUnavailable(201, true));
    await flush();

    expect(result.current).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/marketplace/properties/201');
  });

  it('is false for a plain 404 (a listing that does not exist keeps its own not-found page)', async () => {
    vi.stubGlobal('fetch', respond(404, null));

    const { result } = renderHook(() => useMarketplaceListingUnavailable(201, true));
    await flush();

    expect(result.current).toBe(false);
  });

  it('is false for a listed home and for a failed read', async () => {
    vi.stubGlobal('fetch', respond(200, { listingId: 201 }));
    const listed = renderHook(() => useMarketplaceListingUnavailable(201, true));
    await flush();
    expect(listed.result.current).toBe(false);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const failed = renderHook(() => useMarketplaceListingUnavailable('201', true));
    await flush();
    expect(failed.result.current).toBe(false);
  });

  it('does not ask outside the marketplace (a host\'s own website)', async () => {
    const fetchMock = respond(404, { error: 'LISTING_UNAVAILABLE' });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useMarketplaceListingUnavailable(201, false));
    await flush();

    expect(result.current).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
