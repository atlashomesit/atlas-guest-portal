/**
 * GUEST-065: the summary API sends the next open night as a UTC-midnight timestamp. The cards and the search chip turn it into a
 * date with `${next}T12:00:00`, so the client keeps only the day. A bare date and a missing date are left as they were.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAvailabilitySummary } from './availabilitySummaryClient';

function answer(rows: Array<Record<string, unknown>>) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => rows } as Response);
}

describe('fetchAvailabilitySummary — next open night (GUEST-065)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps only the day of a UTC timestamp', async () => {
    answer([{ listingId: 17, nextAvailableDate: '2026-11-11T00:00:00.0000000Z', percentBookedNext30Days: 17, isAvailableTonight: false }]);
    const [row] = await fetchAvailabilitySummary([17]);
    expect(row.nextAvailableDate).toBe('2026-11-11');
    expect(Number.isNaN(new Date(`${row.nextAvailableDate}T12:00:00`).getTime())).toBe(false);
  });

  it('leaves a bare date, a PascalCase field and a missing date as they were', async () => {
    answer([
      { listingId: 1, nextAvailableDate: '2026-11-12', isAvailableTonight: false },
      { ListingId: 2, NextAvailableDate: '2026-11-13T00:00:00Z', IsAvailableTonight: false },
      { listingId: 3, nextAvailableDate: null, isAvailableTonight: true },
      { listingId: 4, isAvailableTonight: true },
    ]);
    const rows = await fetchAvailabilitySummary([1, 2, 3, 4]);
    expect(rows.map((r) => r.nextAvailableDate)).toEqual(['2026-11-12', '2026-11-13', null, null]);
  });
});
