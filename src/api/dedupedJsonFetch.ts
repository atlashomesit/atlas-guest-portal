/**
 * TASK-7824: module-level in-flight + short-TTL cache for JSON GETs.
 *
 * Property-detail mounts `resolveListing`, `fetchListingById`, similar-listings,
 * and StrictMode double-invoke the same URLs. Per-component refs cannot dedup
 * across those callers. This cache shares one parsed body per URL for TTL_MS.
 */

const TTL_MS = 5_000;

export type DedupedJsonResult = {
  ok: boolean;
  status: number;
  body: unknown;
};

type CacheEntry = {
  promise: Promise<DedupedJsonResult>;
  settledAt: number | null;
};

const inflight = new Map<string, CacheEntry>();

function cacheKey(url: string, init?: RequestInit): string {
  const method = (init?.method ?? "GET").toUpperCase();
  return `${method} ${url}`;
}

export async function dedupedJsonFetch(url: string, init?: RequestInit): Promise<DedupedJsonResult> {
  const key = cacheKey(url, init);
  const callerSignal = init?.signal ?? undefined;
  // Aborting one caller (StrictMode remount, unmount) must not cancel siblings
  // sharing this cache entry — strip signal from the wire GET.
  const { signal: _ignoredSignal, ...restInit } = init ?? {};
  void _ignoredSignal;

  const existing = inflight.get(key);
  const now = Date.now();
  if (existing) {
    const fresh = existing.settledAt == null || now - existing.settledAt < TTL_MS;
    if (fresh) {
      const result = await existing.promise;
      if (callerSignal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      return result;
    }
    inflight.delete(key);
  }

  const promise = (async (): Promise<DedupedJsonResult> => {
    const response = await fetch(url, restInit);
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { ok: response.ok, status: response.status, body };
  })();

  const entry: CacheEntry = { promise, settledAt: null };
  inflight.set(key, entry);

  try {
    const result = await promise;
    entry.settledAt = Date.now();
    if (callerSignal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    return result;
  } catch (err) {
    const callerAborted =
      callerSignal?.aborted === true &&
      err instanceof DOMException &&
      err.name === "AbortError";
    // A caller abort after a successful GET must not drop the shared cache.
    if (!callerAborted) {
      inflight.delete(key);
    }
    throw err;
  }
}

/** Test-only: drop the in-flight/TTL cache. */
export function _resetDedupedJsonFetchForTests(): void {
  inflight.clear();
}
