/**
 * TASK-10299465 (b): the app's side of public/boot-prefetch.js.
 *
 * That script starts the runtime-config request and the tenant lookup while the app's scripts are still downloading and leaves the pending
 * responses on `window.__atlasEarlyFetch`, keyed by the exact URL. `fetchWithEarly` is a drop-in for `fetch(url, init)` that takes the
 * response the script already started when there is one for that exact URL (each response is used once), and asks normally otherwise: when
 * the script never ran (dev server, blocked, slow), when the URL differs, or when the early request failed at the network level.
 */
type EarlyMap = Record<string, Promise<Response> | undefined>;

const takeEarly = (url: string): Promise<Response> | null => {
  if (typeof window === "undefined") return null;
  const holder = window as unknown as { __atlasEarlyFetch?: EarlyMap };
  const map = holder.__atlasEarlyFetch;
  if (!map) {
    // The script has not run (yet). Leave an empty map so that if it only arrives now, after the app already asked for itself (a repeat
    // visit: the app's scripts come from the cache, the script is revalidated over the network), it sees the map and starts nothing.
    holder.__atlasEarlyFetch = {};
    return null;
  }
  const hit = map[url];
  if (!hit) return null;
  delete map[url];
  return hit;
};

// Same call shape as before the early fetch existed: `fetch(url)` stays a one-argument call.
const ownFetch = (url: string, init?: RequestInit): Promise<Response> => (init === undefined ? fetch(url) : fetch(url, init));

export function fetchWithEarly(url: string, init?: RequestInit): Promise<Response> {
  const early = takeEarly(url);
  if (!early) return ownFetch(url, init);
  // A network-level failure of the early request is retried exactly like the app's own request; an HTTP error is a real answer and is returned as is.
  return early.catch(() => ownFetch(url, init));
}
