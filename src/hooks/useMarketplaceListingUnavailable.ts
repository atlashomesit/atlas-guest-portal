import { useEffect, useState } from 'react';
import { buildApiUrl } from '@/api/client';

/** TASK-10299419: the API's 404 code for a marketplace listing hidden by its host's billing. */
export const LISTING_UNAVAILABLE_CODE = 'LISTING_UNAVAILABLE';

/**
 * TASK-10299419 (founder ruling 2026-11-06): a cancelled subscription takes the host's listings off atlastays.com. The API
 * answers GET /marketplace/properties/{id} with 404 { error: "LISTING_UNAVAILABLE" } for a real listing whose host is
 * hidden by billing (cancelled past its period end, Closed, Blocked). True only on that exact answer, so a slow or failed
 * read never hides a bookable home; the server still refuses payment for such a host on its own.
 */
export function useMarketplaceListingUnavailable(listingId: number | string | null | undefined, enabled: boolean): boolean {
  const id = typeof listingId === 'string' && /^\d+$/.test(listingId) ? Number(listingId) : listingId;
  const validId = typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null;
  const [unavailableId, setUnavailableId] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || validId === null) return undefined;
    const controller = new AbortController();
    void fetch(buildApiUrl(`/marketplace/properties/${validId}`), { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (response.status !== 404) return;
        const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
        if (!controller.signal.aborted && body?.error === LISTING_UNAVAILABLE_CODE) setUnavailableId(validId);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [enabled, validId]);

  return enabled && validId !== null && unavailableId === validId;
}
