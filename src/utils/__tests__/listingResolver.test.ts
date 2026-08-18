import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeConfig, setRuntimeConfig } from '@/runtime-config';
import { _resetDedupedJsonFetchForTests } from '@/api/dedupedJsonFetch';
import { fetchListingById } from '@/api/listingClient';
import { resolveListing } from '../listingResolver';

const API_BASE = 'https://atlas-homes-api-dev-fhdtg0gkgmcmhwfd.centralindia-01.azurewebsites.net';

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
    setRuntimeConfig({ apiBaseUrl: API_BASE });
    _resetDedupedJsonFetchForTests();
  });

  afterEach(() => {
    _resetDedupedJsonFetchForTests();
    clearRuntimeConfig();
    vi.unstubAllGlobals();
  });

  it('TASK-7824: numeric listing id does not fall back to GET /listings/public on 404', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ ok: false, status: 404 }));

    const result = await resolveListing('102');

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_BASE}/listings/102`,
      expect.anything(),
    );
  });

  it('TASK-7824: slug-only param still searches GET /listings/public after a 404', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 404 }))
      .mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          json: async () => [{ name: 'Atlas501_PH', listingId: 'atlas-501-ph' }],
        }),
      );

    const result = await resolveListing('atlas501ph');

    expect(result).toMatchObject({ name: 'Atlas501_PH', id: 'atlas-501-ph' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${API_BASE}/listings/public`,
      expect.anything(),
    );
  });

  it('returns null when numeric param=999 is not found without catalog fallback', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ ok: false, status: 404 }));

    const result = await resolveListing('999');

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('TASK-1185: garbage legacy slug does not false-match a short listing name (e.g. "In")', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 404 }))
      .mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          json: async () => [{ name: 'In', listingId: 'in-1', propertyId: 'P1' }],
        }),
      );

    const result = await resolveListing('invalid-slug-xyz-404');

    expect(result).toBeNull();
  });

  it('accepts paged { items } shape from GET /listings/public for slug params', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 404 }))
      .mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ name: 'Atlas102', listingId: 'atlas-102', propertyId: 'P102' }],
          }),
        }),
      );

    const result = await resolveListing('atlas102');

    expect(result).toMatchObject({
      name: 'Atlas102',
      id: 'atlas-102',
      propertyId: 'P102',
    });
  });

  it('TASK-7824: resolveListing and fetchListingById share one GET for the same numeric id', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        ok: true,
        status: 200,
        json: async () => ({ id: 2, name: 'Atlas102', propertyId: 1 }),
      }),
    );

    const [resolved, byId] = await Promise.all([resolveListing('2'), fetchListingById(2)]);

    expect(resolved).toMatchObject({ id: 2, name: 'Atlas102' });
    expect(byId).toMatchObject({ id: 2, name: 'Atlas102' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_BASE}/listings/2`);
  });

  it('returns listing directly when param is Listing.Id (PK)', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        ok: true,
        status: 200,
        json: async () => ({ id: 2, name: 'Atlas102', propertyId: 1 }),
      }),
    );

    const result = await resolveListing('2');

    expect(result).toMatchObject({ id: 2, name: 'Atlas102', propertyId: 1 });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_BASE}/listings/2`,
      expect.anything(),
    );
  });

  it('TRAP FIXTURE: id=2 name=Atlas102 - resolveListing(2) must call /listings/2 not /listings/102', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        ok: true,
        status: 200,
        json: async () => ({ id: 2, name: 'Atlas102', propertyId: 1 }),
      }),
    );

    await resolveListing('2');

    expect(fetchMock).toHaveBeenNthCalledWith(1, `${API_BASE}/listings/2`, expect.anything());
    expect(fetchMock.mock.calls[0][0]).not.toContain('/listings/102');
  });

  it('throws when direct lookup fails with network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(resolveListing('501')).rejects.toThrow(TypeError);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_BASE}/listings/501`,
      expect.anything(),
    );
  });
});
