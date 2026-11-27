import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { getIstCalendarDate, toCalendarISO } from './date';

export type FlexLength = 'weekend' | 'week' | 'month';

export const FLEX_LENGTH_OPTIONS: { value: FlexLength; label: string; subtitle: string; nights: number }[] = [
  { value: 'weekend', label: 'Weekend', subtitle: '2 nights (Fri–Sun)', nights: 2 },
  { value: 'week', label: 'Week', subtitle: '5–7 nights', nights: 5 },
  { value: 'month', label: 'Month', subtitle: '28 nights', nights: 28 },
];

export type FlexMonthOption = {
  key: string; // YYYY-MM
  label: string; // e.g. "Dec 2026"
  shortLabel: string; // e.g. "Dec"
  year: number;
  monthIndex: number; // 0-11
};

export function parseFlexLength(raw: string | null | undefined): FlexLength | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'weekend' || v === 'week' || v === 'month') return v;
  return null;
}

export function parseFlexMonths(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^\d{4}-\d{2}$/.test(s)),
    ),
  ).slice(0, 6);
}

export function parseFlexDays(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(3, Math.max(0, Math.floor(n)));
}

export function getUpcomingFlexMonths(today: Date = getIstCalendarDate(), count = 6): FlexMonthOption[] {
  const result: FlexMonthOption[] = [];
  const startYear = today.getFullYear();
  const startMonth = today.getMonth();
  for (let i = 0; i < count; i++) {
    const d = new Date(startYear, startMonth + i, 1);
    const key = format(d, 'yyyy-MM');
    result.push({
      key,
      label: format(d, 'MMM yyyy'),
      shortLabel: format(d, 'MMM'),
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
    });
  }
  return result;
}

export function formatFlexSummary(flexLength: FlexLength, flexMonths: string[]): string {
  const lengthLabel =
    flexLength === 'weekend' ? 'Weekend' : flexLength === 'week' ? 'Week' : 'Month';
  if (flexMonths.length === 0) return `Any ${lengthLabel.toLowerCase()}`;
  const monthNames = flexMonths.map((ym) => {
    const [y, m] = ym.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
    return format(new Date(y, m - 1, 1), 'MMM');
  });
  return `${lengthLabel} in ${monthNames.join(', ')}`;
}

function parseYmdLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a matched date window for marketplace cards:
 * - Flexible search (no delta): "11–13 Dec · 2 nights"
 * - Shifted date search (MKT-059, delta != 0): "Available 13–15 Dec (+1 day)"
 */
export function formatMatchedWindowBadge(
  checkInIso: string,
  checkOutIso: string,
  deltaDays?: number | null,
): string | null {
  const start = parseYmdLocal(checkInIso);
  const end = parseYmdLocal(checkOutIso);
  if (!start || !end || end <= start) return null;
  const nights = differenceInCalendarDays(end, start);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const rangeStr = sameMonth
    ? `${format(start, 'd')}–${format(end, 'd MMM')}`
    : `${format(start, 'd MMM')}–${format(end, 'd MMM')}`;

  if (typeof deltaDays === 'number' && deltaDays !== 0) {
    const sign = deltaDays > 0 ? '+' : '';
    const abs = Math.abs(deltaDays);
    return `Available ${rangeStr} (${sign}${deltaDays} ${abs === 1 ? 'day' : 'days'})`;
  }
  return `${rangeStr} · ${nights} ${nights === 1 ? 'night' : 'nights'}`;
}

/**
 * Computes a deterministic upcoming qualifying date window for client-side fallback
 * when the API does not return `matchedCheckIn`/`matchedCheckOut`.
 */
export function computeFallbackFlexWindow(
  flexLength: FlexLength,
  flexMonths: string[],
  today: Date = getIstCalendarDate(),
): { checkIn: string; checkOut: string; nights: number } {
  const nights = flexLength === 'weekend' ? 2 : flexLength === 'week' ? 5 : 28;
  const sortedMonths = [...flexMonths].sort();
  let startCandidate = addDays(today, 1);

  if (sortedMonths.length > 0) {
    const [y, m] = sortedMonths[0].split('-').map(Number);
    if (Number.isFinite(y) && Number.isFinite(m)) {
      const monthStart = new Date(y, m - 1, 1);
      if (monthStart > startCandidate) {
        startCandidate = monthStart;
      }
    }
  }

  if (flexLength === 'weekend') {
    // Advance to the next Friday (day 5)
    const dow = startCandidate.getDay();
    const daysUntilFri = (5 - dow + 7) % 7;
    startCandidate = addDays(startCandidate, daysUntilFri);
  }

  const endCandidate = addDays(startCandidate, nights);
  return {
    checkIn: toCalendarISO(startCandidate),
    checkOut: toCalendarISO(endCandidate),
    nights,
  };
}
