/**
 * TASK-1040071 / TASK-1040072: the marketplace endpoints clamp pageSize to 100 (a larger value silently
 * becomes 20 - MarketplaceController.NormalizePageSize), so a client that wants "all homes" must ask for
 * <= 100 and page. One helper so every caller agrees with the server's maximum.
 */
export const MARKETPLACE_MAX_PAGE_SIZE = 100;
/** Safety bound (10 x 100 = 1,000 homes); the loop also stops on `total` or a short page. */
export const MARKETPLACE_MAX_PAGES = 10;

export interface MarketplacePageRead<T> {
  rows: T[];
  /** Server-reported grand total, when the endpoint has one (/marketplace/listings does, /properties does not). */
  total?: number;
}

/**
 * Fetches page 1..N (pageSize = server maximum) and returns every row, de-duplicated by `rowKey`.
 * Page 1 failing (non-OK or network error) behaves as the caller's single fetch did: non-OK gives [],
 * a thrown error propagates. A later page failing keeps what was already gathered.
 */
export async function fetchAllMarketplacePages<T>(opts: {
  buildUrl: (page: number, pageSize: number) => string;
  readPage: (json: unknown) => MarketplacePageRead<T>;
  rowKey: (row: T) => string | number;
  init?: RequestInit;
  fetchImpl?: typeof fetch;
  /** Checked before each extra page so an unmounted component stops paging. */
  shouldStop?: () => boolean;
}): Promise<T[]> {
  const doFetch = opts.fetchImpl ?? fetch;
  const all: T[] = [];
  const seen = new Set<string | number>();
  for (let page = 1; page <= MARKETPLACE_MAX_PAGES; page++) {
    if (page > 1 && opts.shouldStop?.()) break;
    let read: MarketplacePageRead<T>;
    try {
      const res = await doFetch(opts.buildUrl(page, MARKETPLACE_MAX_PAGE_SIZE), opts.init);
      if (!res.ok || typeof res.json !== 'function') {
        if (page === 1) return [];
        break;
      }
      read = opts.readPage(await res.json());
    } catch (err) {
      if (page === 1) throw err;
      break;
    }
    let added = 0;
    for (const row of read.rows) {
      const key = opts.rowKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(row);
      added++;
    }
    if (read.rows.length < MARKETPLACE_MAX_PAGE_SIZE || added === 0) break;
    if (typeof read.total === 'number' && all.length >= read.total) break;
  }
  return all;
}
