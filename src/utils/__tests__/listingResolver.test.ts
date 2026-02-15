import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeConfig, setRuntimeConfig } from '@/runtime-config';
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
  });

  afterEach(() => {
    clearRuntimeConfig();
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
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_BASE}/listings/102`,
      expect.objectContaining({ signal: undefined }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${API_BASE}/listings/public`,
      expect.objectContaining({ signal: undefined }),
    );
  });

  it('matches Atlas501_PH when param=501 (param is substring of name)', async () => {
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

    expect(result).toMatchObject({ name: 'Atlas501_PH', id: 'atlas-501-ph' });
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

  it('throws when direct lookup fails with network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(resolveListing('501')).rejects.toThrow(TypeError);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_BASE}/listings/501`,
      expect.objectContaining({ signal: undefined }),
    );
  });
});
