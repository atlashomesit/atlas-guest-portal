import { buildApiUrl, getApiHeaders } from '@/api/client';
import { messageFromApiResponse } from '@/utils/serverErrorFromResponse';

/**
 * TASK-101733: guest caller for the server-side promo-code A/B endpoint.
 *
 * Host tooling already configures per-listing A/B groups (AbGroupTag / AbTrafficPct
 * on promo codes, TASK-2006), and the API serves weighted suggestions at
 * GET /api/promo-codes/ab-suggest?listingId=&groupTag= (AllowAnonymous, increments
 * AbImpressions on the returned code) — but nothing in the guest portal ever called
 * it, so A/B impressions stayed at whatever the host preview generated.
 */
export const AB_SUGGEST_ENDPOINT = '/api/promo-codes/ab-suggest';

export type AbSuggestResult = {
  code: string;
  discountType: string;
  discountValue: number;
  /**
   * Server-incremented impression count echoed back with the suggestion.
   * Null when the server omits it — callers must not treat it as a discount input.
   */
  abImpressions: number | null;
};

/**
 * GET /api/promo-codes/ab-suggest?listingId=&groupTag= — returns one weighted
 * suggestion from the listing's A/B group, or null when the group has no active
 * codes (server 404). Throws on missing args or any other non-OK response.
 */
export async function fetchAbSuggest(
  listingId: string | number,
  groupTag: string,
  signal?: AbortSignal,
): Promise<AbSuggestResult | null> {
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('listingId must be a positive number.');
  }
  const tag = String(groupTag ?? '').trim();
  if (!tag) {
    throw new Error('groupTag is required.');
  }

  const url = new URL(buildApiUrl(AB_SUGGEST_ENDPOINT));
  url.searchParams.set('listingId', String(id));
  url.searchParams.set('groupTag', tag);

  const response = await fetch(url.toString(), { signal, headers: getApiHeaders() });
  // No active A/B codes for this listing/group — not an error, just nothing to suggest.
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const code = String(raw.code ?? raw.Code ?? '').trim();
  if (!code) {
    throw new Error('Promo A/B suggestion response did not include a code.');
  }
  const discountValue = raw.discountValue ?? raw.DiscountValue;
  const abImpressions = raw.abImpressions ?? raw.AbImpressions;
  return {
    code,
    discountType: String(raw.discountType ?? raw.DiscountType ?? ''),
    discountValue: discountValue !== undefined && discountValue !== null ? Number(discountValue) : 0,
    abImpressions:
      abImpressions !== undefined && abImpressions !== null ? Number(abImpressions) : null,
  };
}
