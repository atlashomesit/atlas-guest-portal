/**
 * TASK-2118: Module-level in-flight dedup for `/api/public/listings/{id}/availability-calendar`.
 *
 * The guest listing detail route renders two components that each need the same
 * availability-calendar data: `UnitBookingWidget` and `AvailabilityCalendar`.
 * Under React StrictMode + lazy/Suspense double-mount, each component can fire
 * the same GET up to twice, pushing the network-call count past the duplicate-
 * fetch guard. Per-component refs cannot dedup across separate component instances
 * (or across a strict-mode unmount → remount, which discards the ref).
 *
 * This module-level cache shares a single in-flight `Promise<Response | null>`
 * across all callers for a brief TTL, so the wire-level GET count drops to at
 * most one per unique URL per `TTL_MS`. Both callers still get the parsed body
 * via `response.clone()` and follow their own error-handling paths.
 *
 * No retries, no schema parsing — this stays as low-level as `fetch` itself so
 * the existing UnitBookingWidget / AvailabilityCalendar logic continues to own
 * response parsing, status messaging, and error filtering.
 */

const TTL_MS = 5_000;

type CacheEntry = {
  /** Resolves to the original Response. Callers MUST clone before reading. */
  promise: Promise<Response>;
  /** Settled timestamp (epoch ms); used to expire cache entries after TTL_MS. */
  settledAt: number | null;
};

const inflight = new Map<string, CacheEntry>();

/**
 * Fetch with module-level in-flight dedup. Returns a clone of the Response so
 * each caller can read body independently.
 *
 * The cache only dedups identical URLs that are either in-flight or settled
 * within the last `TTL_MS`. After TTL elapses, the next call re-fetches.
 */
export async function dedupedAvailabilityCalendarFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const existing = inflight.get(url);
  const now = Date.now();
  if (existing) {
    const fresh = existing.settledAt == null || now - existing.settledAt < TTL_MS;
    if (fresh) {
      const response = await existing.promise;
      return response.clone();
    }
    inflight.delete(url);
  }

  const promise = fetch(url, init);
  const entry: CacheEntry = { promise, settledAt: null };
  inflight.set(url, entry);

  try {
    const response = await promise;
    entry.settledAt = Date.now();
    return response.clone();
  } catch (err) {
    // Drop failed requests immediately so retries from a subsequent mount can
    // attempt a fresh GET. Without this, the failure would be re-thrown to
    // every subsequent caller within TTL_MS, surfacing a transient blip as a
    // persistent error.
    inflight.delete(url);
    throw err;
  }
}

/** Test-only: clear the in-flight cache. */
export function _resetAvailabilityCalendarCacheForTests(): void {
  inflight.clear();
}
