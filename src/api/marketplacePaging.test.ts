import { describe, expect, it, vi } from 'vitest';
import { fetchAllMarketplacePages, MARKETPLACE_MAX_PAGE_SIZE, MARKETPLACE_MAX_PAGES } from './marketplacePaging';

type Row = { id: number };
const rows = (from: number, n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: from + i }));
const ok = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response;
const readArray = (j: unknown) => ({ rows: j as Row[] });

describe('fetchAllMarketplacePages (TASK-1040071 / TASK-1040072)', () => {
  it('never asks for a pageSize above the server maximum and pages to the end of a bare-array endpoint', async () => {
    const all = rows(1, 230);
    const fetchImpl = vi.fn(async (url: string) => {
      const u = new URL(url, 'https://api.test');
      const page = Number(u.searchParams.get('page'));
      const size = Number(u.searchParams.get('pageSize'));
      return ok(all.slice((page - 1) * size, page * size));
    });
    const out = await fetchAllMarketplacePages<Row>({
      buildUrl: (p, s) => `/marketplace/properties?page=${p}&pageSize=${s}`,
      readPage: readArray,
      rowKey: (r) => r.id,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out).toHaveLength(230);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const [url] of fetchImpl.mock.calls) {
      expect(Number(new URL(url, 'https://api.test').searchParams.get('pageSize'))).toBeLessThanOrEqual(
        MARKETPLACE_MAX_PAGE_SIZE,
      );
    }
  });

  it('stops at total, so an exact multiple of the page size costs no empty extra request', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const page = Number(new URL(url, 'https://api.test').searchParams.get('page'));
      return ok({ items: rows((page - 1) * 100 + 1, 100), total: 200 });
    });
    const out = await fetchAllMarketplacePages<Row>({
      buildUrl: (p, s) => `/x?page=${p}&pageSize=${s}`,
      readPage: (j) => ({ rows: (j as { items: Row[] }).items, total: (j as { total: number }).total }),
      rowKey: (r) => r.id,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out).toHaveLength(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('is bounded: an endpoint that ignores page and returns a full page each time cannot loop forever', async () => {
    const fetchImpl = vi.fn(async () => ok(rows(1, 100)));
    const out = await fetchAllMarketplacePages<Row>({
      buildUrl: (p, s) => `/x?page=${p}&pageSize=${s}`,
      readPage: readArray,
      rowKey: (r) => r.id,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out).toHaveLength(100); // page 2 added nothing new -> stop
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(MARKETPLACE_MAX_PAGES);
  });

  it('page 1 non-OK gives [], a later page failing keeps what was gathered, shouldStop halts paging', async () => {
    const bad = vi.fn(async () => ({ ok: false }) as unknown as Response);
    expect(
      await fetchAllMarketplacePages<Row>({
        buildUrl: () => '/x',
        readPage: readArray,
        rowKey: (r) => r.id,
        fetchImpl: bad as unknown as typeof fetch,
      }),
    ).toEqual([]);

    let n = 0;
    const flaky = vi.fn(async () => {
      n++;
      if (n === 2) throw new Error('net');
      return ok(rows(1, 100));
    });
    const partial = await fetchAllMarketplacePages<Row>({
      buildUrl: () => '/x',
      readPage: readArray,
      rowKey: (r) => r.id,
      fetchImpl: flaky as unknown as typeof fetch,
    });
    expect(partial).toHaveLength(100);

    const one = vi.fn(async () => ok(rows(1, 100)));
    await fetchAllMarketplacePages<Row>({
      buildUrl: () => '/x',
      readPage: readArray,
      rowKey: (r) => r.id,
      fetchImpl: one as unknown as typeof fetch,
      shouldStop: () => true,
    });
    expect(one).toHaveBeenCalledTimes(1);
  });
});
