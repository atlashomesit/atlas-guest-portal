/**
 * TASK-102267 — Flexible-dates pricing matrix (lowest-price month view).
 */

export type RateBand = 'lowest' | 'mid' | 'peak';

export interface DayRate {
  dateIso: string;
  nightlyInr: number;
}

export function rateBand(day: DayRate, minInr: number, maxInr: number): RateBand {
  if (maxInr <= minInr) return 'lowest';
  const t = (day.nightlyInr - minInr) / (maxInr - minInr);
  if (t <= 1 / 3) return 'lowest';
  if (t <= 2 / 3) return 'mid';
  return 'peak';
}

export const RATE_BAND_STYLES: Record<RateBand, string> = {
  lowest: 'bg-green-100 text-green-900',
  mid: 'bg-yellow-100 text-yellow-900',
  peak: 'bg-amber-200 text-amber-950',
};

export function cheapestDay(rates: DayRate[]): DayRate | null {
  if (!rates.length) return null;
  return rates.reduce((a, b) => (b.nightlyInr < a.nightlyInr ? b : a));
}

export function bandedMonth(rates: DayRate[]): { dateIso: string; band: RateBand; style: string }[] {
  if (!rates.length) return [];
  const prices = rates.map((r) => r.nightlyInr);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return rates.map((r) => ({ dateIso: r.dateIso, band: rateBand(r, min, max), style: RATE_BAND_STYLES[rateBand(r, min, max)] }));
}
