import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeConfig, setRuntimeConfig } from '@/runtime-config';
import { AB_SUGGEST_ENDPOINT, fetchAbSuggest } from './promoAbClient';

const defaultRuntimeConfig = {
  apiBaseUrl: 'https://api.test',
};

beforeEach(() => {
  setRuntimeConfig(defaultRuntimeConfig);
});

afterEach(() => {
  clearRuntimeConfig();
  vi.unstubAllGlobals();
});

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

/**
 * TASK-101733: the guest portal never called GET /api/promo-codes/ab-suggest, so
 * host-configured A/B groups collected no guest impressions. fetchAbSuggest is the
 * guest-side caller — these tests pin the request shape and the response parsing,
 * including the server-incremented impressions echo the e2e assert relies on.
 */
describe('fetchAbSuggest — TASK-101733 guest A/B suggestion caller', () => {
  it('calls GET ab-suggest with listingId + groupTag query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse({ code: 'SAVE10', discountType: 'Percent', discountValue: 10, abImpressions: 41 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchAbSuggest(42, 'summer-hero');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url.startsWith(`https://api.test${AB_SUGGEST_ENDPOINT}`)).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('listingId')).toBe('42');
    expect(parsed.searchParams.get('groupTag')).toBe('summer-hero');
  });

  it('parses the suggestion including the server-incremented abImpressions echo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okResponse({ code: 'SAVE10', discountType: 'Percent', discountValue: 10, abImpressions: 41 }),
      ),
    );

    const result = await fetchAbSuggest(42, 'summer-hero');

    // abImpressions is reporting metadata (server incremented it on this serve);
    // the e2e impressions assert keys off this field, so it must survive parsing.
    expect(result).toEqual({
      code: 'SAVE10',
      discountType: 'Percent',
      discountValue: 10,
      abImpressions: 41,
    });
  });

  it('tolerates PascalCase server DTO casing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okResponse({ Code: 'FLAT500', DiscountType: 'Flat', DiscountValue: 500, AbImpressions: 7 }),
      ),
    );

    const result = await fetchAbSuggest('9', 'monsoon');

    expect(result).toEqual({
      code: 'FLAT500',
      discountType: 'Flat',
      discountValue: 500,
      abImpressions: 7,
    });
  });

  it('returns null on 404 (no active A/B codes) instead of throwing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAbSuggest(42, 'empty-group')).resolves.toBeNull();
  });

  it('throws on non-404 errors without masking the server message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        clone: () => ({ text: async () => JSON.stringify({ error: 'groupTag is required.' }) }),
        text: async () => JSON.stringify({ error: 'groupTag is required.' }),
      }),
    );

    await expect(fetchAbSuggest(42, 'x')).rejects.toThrow('groupTag is required.');
  });

  it('throws before fetch when listingId/groupTag are missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAbSuggest(0, 'g')).rejects.toThrow('listingId');
    await expect(fetchAbSuggest(42, '   ')).rejects.toThrow('groupTag');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
