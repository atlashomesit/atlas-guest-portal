import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveListing } from '../listingResolver';

const LISTING_ENDPOINT =
  'https://atlas-homes-api-dev-fhdtg0gkgmcmhwfd.centralindia-01.azurewebsites.net/listings';

const fetchMock = vi.fn();

const makeResponse = (options: { ok: boolean; status: number; json?: () => Promise<unknown> }) => ({
  ok: options.ok,
  status: options.status,
  json: options.json ?? (async () => ({})),
});

describe('resolveListing', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('matches Atlas102 when param=102', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 404 }))
      .mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          json: async () => [{ name: 'Atlas102', listingId: 'atlas-102', propertyId: 'P102' }],
        }),
      );

    const result = await resolveListing('102');

    expect(result).toMatchObject({
      name: 'Atlas102',
      id: 'atlas-102',
      propertyId: 'P102',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, `${LISTING_ENDPOINT}/102`, { signal: undefined });
    expect(fetchMock).toHaveBeenNthCalledWith(2, LISTING_ENDPOINT, { signal: undefined });
  });

  it('returns null when suffix mismatch occurs (Atlas501_PH vs param=501)', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 404 }))
      .mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          json: async () => [{ name: 'Atlas501_PH', listingId: 'atlas-501-ph' }],
        }),
      );

    const result = await resolveListing('501');

    expect(result).toBeNull();
  });

  it('returns null when param=999 is not found', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 404 }))
      .mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          json: async () => [{ name: 'Atlas102', listingId: 'atlas-102' }],
        }),
      );

    const result = await resolveListing('999');

    expect(result).toBeNull();
  });
});
