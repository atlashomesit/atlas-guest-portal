import { buildApiUrl, getApiHeaders } from '@/api/client';
import { messageFromApiResponse } from '@/utils/serverErrorFromResponse';

/** TASK-1460: matches API `ListingAvailabilitySummaryDto` (camelCase JSON). */
export type ListingAvailabilitySummary = {
  listingId: number;
  nextAvailableDate?: string | null;
  percentBookedNext30Days: number;
  isAvailableTonight: boolean;
};

function normalizeSummary(row: Record<string, unknown>): ListingAvailabilitySummary | null {
  const listingId = Number(row.listingId ?? row.ListingId);
  if (!Number.isFinite(listingId) || listingId <= 0) return null;
  const pct = Number(row.percentBookedNext30Days ?? row.PercentBookedNext30Days ?? 0);
  const rawNext = row.nextAvailableDate ?? row.NextAvailableDate;
  const next =
    rawNext == null || rawNext === ''
      ? null
      : typeof rawNext === 'string'
        ? rawNext
        : null;
  const tonight = Boolean(row.isAvailableTonight ?? row.IsAvailableTonight);
  return {
    listingId,
    nextAvailableDate: next,
    percentBookedNext30Days: Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.round(pct))) : 0,
    isAvailableTonight: tonight,
  };
}

/** Batch next-30-night hints for guest listing cards (public_guest rate limit). */
export async function fetchAvailabilitySummary(
  listingIds: number[],
  signal?: AbortSignal,
): Promise<ListingAvailabilitySummary[]> {
  const ids = [...new Set(listingIds.filter((id) => id > 0))].slice(0, 48);
  if (ids.length === 0) return [];

  const url = buildApiUrl(`/availability/summary?listingIds=${encodeURIComponent(ids.join(','))}`);
  const res = await fetch(url, { headers: getApiHeaders(), signal });
  if (!res.ok) {
    throw new Error(await messageFromApiResponse(res));
  }
  const payload = (await res.json()) as unknown;
  if (!Array.isArray(payload)) return [];
  return payload
    .map((row) => normalizeSummary(row as Record<string, unknown>))
    .filter((x): x is ListingAvailabilitySummary => x != null);
}
