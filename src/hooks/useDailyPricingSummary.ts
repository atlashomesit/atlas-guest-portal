import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  fetchDailySummary,
  getTodayBreakdownFromListing,
  type DailyPricingSummaryDto,
  type TodayBreakdown,
} from '@/api/pricingClient';

type CacheState =
  | { status: 'idle' }
  | { status: 'loading'; promise: Promise<DailyPricingSummaryDto> }
  | { status: 'success'; data: DailyPricingSummaryDto; storedAt: number }
  | { status: 'error'; error: Error };

/** Catalog-wide (`*`) vs one listing. Search/favorites stay on `*`. */
const cacheByKey = new Map<string, CacheState>();

/**
 * TASK-102563: bounded cache TTL so a tab left open overnight never feeds a
 * stale estimate into the live booking widget. 5 minutes — chosen well under
 * a normal host re-pricing cadence and the booking-hold window (15 min),
 * so a guest is never quoted a rate the server has already retired.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

function isFresh(state: CacheState | undefined): state is { status: 'success'; data: DailyPricingSummaryDto; storedAt: number } {
  return !!state && state.status === 'success' && Date.now() - state.storedAt < CACHE_TTL_MS;
}

function cacheKey(listingId?: string | number): string {
  if (listingId == null || String(listingId).trim() === '') return '*';
  return String(listingId);
}

function getCachedOrFetch(listingId?: string | number): Promise<DailyPricingSummaryDto> {
  const key = cacheKey(listingId);
  const cache = cacheByKey.get(key) ?? { status: 'idle' };
  if (isFresh(cache)) {
    return Promise.resolve(cache.data);
  }
  if (cache.status === 'loading') {
    return cache.promise;
  }
  const controller = new AbortController();
  const promise = fetchDailySummary(controller.signal, listingId)
    .then((data) => {
      cacheByKey.set(key, { status: 'success', data, storedAt: Date.now() });
      return data;
    })
    .catch((err) => {
      cacheByKey.set(key, {
        status: 'error',
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    });
  cacheByKey.set(key, { status: 'loading', promise });
  return promise;
}

/**
 * TASK-102563: drop every cached entry so the next mount refetches. Fired on
 * visibility-regain (a tab returning to the foreground after >TTL is
 * definitionally stale — the guest saw the pre-hidden state) and available to
 * callers that mutate rates locally.
 */
export function invalidateDailyPricingCache(): void {
  cacheByKey.clear();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') invalidateDailyPricingCache();
  });
}

export function useDailyPricingSummary(
  listingId?: string | number,
  options?: { skip?: boolean },
): {
  data: DailyPricingSummaryDto | null;
  loading: boolean;
  error: Error | null;
  getListingPricing: (listingId: string | number) => TodayBreakdown | null;
} {
  // TASK-2118 / TASK-7823 follow-up: `skip` lets a single-listing page (PropertyDetails) wait for
  // its OWN listingId to resolve before fetching anything, instead of firing the catalog-wide
  // (`*`) request on first render and then immediately refetching scoped once the id is known.
  // That stray `*` request is what TASK-7823 already intended to stop on property pages, and it
  // is a real console-error source (CORS on a highly-contended shared cache bucket) — see
  // PropertyDetails.tsx / Homepage_PropertyDetails.tsx call sites. Pages that intentionally want
  // every listing (SearchPage, FavoritesPage, HomePage_Locations) never pass `options`, so `skip`
  // defaults to false and their existing fetch-on-mount behaviour is unchanged.
  const skip = options?.skip ?? false;
  const key = cacheKey(listingId);
  const cache = cacheByKey.get(key) ?? { status: 'idle' };
  const [data, setData] = useState<DailyPricingSummaryDto | null>(
    !skip && isFresh(cache) ? cache.data : null,
  );
  const [loading, setLoading] = useState(
    // Not fresh = idle, loading, error or TTL-expired success: each one waits on or starts a fetch.
    // (The old ternary's else-branch compared a narrowed fresh 'success' to 'loading'/'idle' -- always
    // false, and a TS2367 error under tsconfig.app.json.)
    skip || !isFresh(cache),
  );
  const [error, setError] = useState<Error | null>(
    !skip && cache.status === 'error' ? cache.error : null,
  );

  useEffect(() => {
    if (skip) {
      // Still waiting on our own listingId -- do not touch the cache at all (in particular,
      // never populate or read the catalog-wide `*` bucket on behalf of a single listing).
      setData(null);
      setError(null);
      setLoading(true);
      return;
    }
    const current = cacheByKey.get(key) ?? { status: 'idle' };
    if (isFresh(current)) {
      setData(current.data);
      setLoading(false);
      setError(null);
      return;
    }
    if (current.status === 'error') {
      setData(null);
      setLoading(false);
      setError(current.error);
      return;
    }
    setLoading(true);
    getCachedOrFetch(listingId)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e : new Error(String(e)));
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [key, listingId, skip]);

  const listingMap = useMemo(() => {
    if (!data?.listings?.length) return new Map<string, TodayBreakdown>();
    const map = new Map<string, TodayBreakdown>();
    for (const listing of data.listings) {
      const breakdown = getTodayBreakdownFromListing(listing);
      map.set(String(listing.listingId), breakdown);
    }
    return map;
  }, [data?.listings]);

  const getListingPricing = useCallback(
    (id: string | number): TodayBreakdown | null => {
      return listingMap.get(String(id)) ?? null;
    },
    [listingMap],
  );

  return { data, loading, error, getListingPricing };
}
