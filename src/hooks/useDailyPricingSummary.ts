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
  | { status: 'success'; data: DailyPricingSummaryDto }
  | { status: 'error'; error: Error };

let cache: CacheState = { status: 'idle' };

function getCachedOrFetch(): Promise<DailyPricingSummaryDto> {
  if (cache.status === 'success') {
    return Promise.resolve(cache.data);
  }
  if (cache.status === 'loading') {
    return cache.promise;
  }
  const controller = new AbortController();
  const promise = fetchDailySummary(controller.signal)
    .then((data) => {
      cache = { status: 'success', data };
      return data;
    })
    .catch((err) => {
      cache = { status: 'error', error: err instanceof Error ? err : new Error(String(err)) };
      throw err;
    });
  cache = { status: 'loading', promise };
  return promise;
}

export function useDailyPricingSummary(): {
  data: DailyPricingSummaryDto | null;
  loading: boolean;
  error: Error | null;
  getListingPricing: (listingId: string | number) => TodayBreakdown | null;
} {
  const [data, setData] = useState<DailyPricingSummaryDto | null>(
    cache.status === 'success' ? cache.data : null,
  );
  const [loading, setLoading] = useState(cache.status === 'loading');
  const [error, setError] = useState<Error | null>(
    cache.status === 'error' ? cache.error : null,
  );

  useEffect(() => {
    if (cache.status === 'success') {
      setData(cache.data);
      setLoading(false);
      setError(null);
      return;
    }
    if (cache.status === 'error') {
      setData(null);
      setLoading(false);
      setError(cache.error);
      return;
    }
    setLoading(true);
    getCachedOrFetch()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e : new Error(String(e)));
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

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
    (listingId: string | number): TodayBreakdown | null => {
      return listingMap.get(String(listingId)) ?? null;
    },
    [listingMap],
  );

  return { data, loading, error, getListingPricing };
}
