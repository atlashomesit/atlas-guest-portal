import { buildApiUrl, getApiHeaders } from '@/api/client';
import { messageFromApiResponse } from '@/utils/serverErrorFromResponse';

/**
 * TASK-7491 (Rate Sync Authority — outbound rate push opt-out): per-day record from
 * GET /api/pricing/availability-rates (`GuestDayAvailabilityRateDto`, via GuestPricingService).
 * `bookable` / `reason` / `priceSource` are additive fields — see
 * atlas-api/docs/api-contract.md § TASK-7491. For every existing tenant (rates ON everywhere at
 * rollout) `bookable` mirrors `isAvailable`, `reason`/`priceSource` are null: zero behaviour
 * change until a tenant actually opts a scope out of outbound rate pushes.
 *
 * Closed vocabularies (do not widen without an api-contract.md update):
 * - `reason`: `"no_usable_rate"` is the only v1 value (beyond-cap / no-prior-rate /
 *   unresolved-price-authority — the guest UI treats all three identically: render unavailable).
 * - `priceSource`: `"channel_inbound"` (the date's own inbound OTA rate) |
 *   `"carried_forward"` (a prior date's inbound rate, within the carry-forward cap) |
 *   `null` (normal Atlas pricing — rates ON for this scope).
 */
export type GuestAvailabilityRateDay = {
  date: string;
  nightlyRate: number;
  roomsAvailable: number;
  isAvailable: boolean;
  /** false = fail-closed: no usable inbound rate for this date. Never render a price or allow selection. */
  bookable: boolean;
  reason: string | null;
  priceSource: 'channel_inbound' | 'carried_forward' | null;
};

export type AvailabilityRatesParams = {
  listingId: string | number;
  startDate: string;
  endDate: string;
  signal?: AbortSignal;
};

const AVAILABILITY_RATES_ENDPOINT = '/api/pricing/availability-rates';

/** `row.field ?? row.Field` — tolerate camelCase/PascalCase JSON like every other client here. */
function pick(row: Record<string, unknown>, camel: string, pascal: string): unknown {
  return row[camel] ?? row[pascal];
}

function normalizeDay(row: Record<string, unknown>): GuestAvailabilityRateDay | null {
  const dateRaw = pick(row, 'date', 'Date');
  if (typeof dateRaw !== 'string' || dateRaw.length === 0) return null;

  // Additive field: if a response somehow omits `bookable` (older cache, unaffected scope),
  // default to bookable/true — never fail a date closed on a field's mere ABSENCE. A real
  // no-usable-rate date always sends `bookable: false` explicitly per the contract.
  const bookableRaw = pick(row, 'bookable', 'Bookable');
  const bookable = bookableRaw === undefined || bookableRaw === null ? true : Boolean(bookableRaw);

  const reasonRaw = pick(row, 'reason', 'Reason');
  const reason = typeof reasonRaw === 'string' && reasonRaw.length > 0 ? reasonRaw : null;

  const priceSourceRaw = pick(row, 'priceSource', 'PriceSource');
  const priceSource =
    priceSourceRaw === 'channel_inbound' || priceSourceRaw === 'carried_forward' ? priceSourceRaw : null;

  const nightlyRateRaw = pick(row, 'nightlyRate', 'NightlyRate');
  const roomsAvailableRaw = pick(row, 'roomsAvailable', 'RoomsAvailable');
  const isAvailableRaw = pick(row, 'isAvailable', 'IsAvailable');

  return {
    date: dateRaw.slice(0, 10),
    nightlyRate: Number(nightlyRateRaw ?? 0),
    roomsAvailable: Number(roomsAvailableRaw ?? 0),
    isAvailable: Boolean(isAvailableRaw),
    bookable,
    reason,
    priceSource,
  };
}

/**
 * GET /api/pricing/availability-rates?listingId=&startDate=&endDate= — guest-facing per-day
 * availability + rate for a listing, including the TASK-7491 bookable/reason/priceSource
 * fail-closed fields. Response wrapper shape isn't pinned beyond "has a days[] array" (contract:
 * `GuestAvailabilityRateResponseDto`) — tolerate `{ days }`, `{ Days }`, or a bare array.
 */
export async function fetchAvailabilityRates({
  listingId,
  startDate,
  endDate,
  signal,
}: AvailabilityRatesParams): Promise<GuestAvailabilityRateDay[]> {
  const url = new URL(buildApiUrl(AVAILABILITY_RATES_ENDPOINT));
  url.searchParams.set('listingId', String(listingId));
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', endDate);

  const response = await fetch(url.toString(), { signal, headers: getApiHeaders() });
  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  const raw = (await response.json()) as unknown;
  const rows: unknown = Array.isArray(raw)
    ? raw
    : (raw as { days?: unknown; Days?: unknown } | null)?.days ??
      (raw as { days?: unknown; Days?: unknown } | null)?.Days ??
      [];
  if (!Array.isArray(rows)) return [];

  return rows
    .map((r) => normalizeDay(r as Record<string, unknown>))
    .filter((d): d is GuestAvailabilityRateDay => d != null);
}

/**
 * Server-side cap on a single /api/pricing/availability-rates request (TASK-8350).
 * Keep in step with PricingController.cs; a client asking for more gets a 400.
 */
const MAX_RANGE_DAYS = 60;

function addDaysToIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function daysBetweenIso(startIso: string, endIso: string): number {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  const ms = Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd);
  return Math.round(ms / 86_400_000);
}

/**
 * Split [startIso, endIso] into consecutive windows of at most `maxDays` days each.
 * Windows are contiguous and non-overlapping: each starts the day after the previous ended.
 */
export function splitIsoRange(
  startIso: string,
  endIso: string,
  maxDays: number,
): Array<{ start: string; end: string }> {
  if (daysBetweenIso(startIso, endIso) <= 0) return [{ start: startIso, end: endIso }];

  const windows: Array<{ start: string; end: string }> = [];
  let cursor = startIso;
  // Guard the loop: a bad maxDays must not spin forever.
  const step = Math.max(1, maxDays);
  while (daysBetweenIso(cursor, endIso) > 0) {
    const remaining = daysBetweenIso(cursor, endIso);
    const span = Math.min(step, remaining);
    windows.push({ start: cursor, end: addDaysToIsoDate(cursor, span) });
    cursor = addDaysToIsoDate(cursor, span + 1);
  }
  return windows;
}

function addMonthsToIsoDate(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1 + months, d);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Convenience wrapper mirroring `fetchCalendarPricing`'s `(listingId, startMonthIso, months,
 * signal)` shape (src/api/pricingClient.ts) so call sites/effects can stay parallel to the
 * existing per-day pricing fetches. `months` is a whole-month window starting at `startMonthIso`.
 */
export async function fetchAvailabilityRatesForMonths(
  listingId: string | number,
  startMonthIso: string,
  months: number,
  signal?: AbortSignal,
): Promise<GuestAvailabilityRateDay[]> {
  const endIso = addMonthsToIsoDate(startMonthIso, Math.max(1, months));

  // TASK-8350 capped this endpoint at 60 days per request (PricingController.cs:867 --
  // `if (days > 60) return BadRequest("Range cannot exceed 60 days.")`). The booking widget
  // asks for 3 months (~91 days), so a single request 400s and the calendar renders empty.
  // Split the window instead of narrowing it: the cap bounds work PER REQUEST, and shrinking
  // the calendar to 60 days would be a silent product regression for the guest.
  const windows = splitIsoRange(startMonthIso, endIso, MAX_RANGE_DAYS);
  const pages = await Promise.all(
    windows.map((w) =>
      fetchAvailabilityRates({ listingId, startDate: w.start, endDate: w.end, signal }),
    ),
  );

  // Windows are half-open and never overlap, so a plain concat cannot duplicate a day.
  return pages.flat();
}
