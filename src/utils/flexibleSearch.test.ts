import { describe, expect, it } from 'vitest';
import {
  computeFallbackFlexWindow,
  formatFlexSummary,
  formatMatchedWindowBadge,
  getUpcomingFlexMonths,
  parseFlexDays,
  parseFlexLength,
  parseFlexMonths,
} from './flexibleSearch';

describe('flexibleSearch (MKT-058 / MKT-059)', () => {
  it('parses flexLength and flexMonths safely from URL params', () => {
    expect(parseFlexLength('weekend')).toBe('weekend');
    expect(parseFlexLength('WEEK')).toBe('week');
    expect(parseFlexLength('month')).toBe('month');
    expect(parseFlexLength('invalid')).toBeNull();
    expect(parseFlexMonths('2026-12,2027-01,bad,2026-12')).toEqual(['2026-12', '2027-01']);
  });

  it('clamps flexDays to 0..3', () => {
    expect(parseFlexDays('0')).toBe(0);
    expect(parseFlexDays('2')).toBe(2);
    expect(parseFlexDays('9')).toBe(3);
    expect(parseFlexDays('-1')).toBe(0);
    expect(parseFlexDays(null)).toBe(0);
  });

  it('formats flexible summary and upcoming months', () => {
    const months = getUpcomingFlexMonths(new Date(2026, 10, 27), 6);
    expect(months).toHaveLength(6);
    expect(months[0].key).toBe('2026-11');
    expect(months[1].key).toBe('2026-12');
    expect(formatFlexSummary('weekend', ['2026-12', '2027-01'])).toBe('Weekend in Dec, Jan');
    expect(formatFlexSummary('week', [])).toBe('Any week');
  });

  it('formats matched date window badge for flexible and shifted-date results', () => {
    expect(formatMatchedWindowBadge('2026-12-11', '2026-12-13')).toBe('11–13 Dec · 2 nights');
    expect(formatMatchedWindowBadge('2026-12-13', '2026-12-15', 1)).toBe('Available 13–15 Dec (+1 day)');
    expect(formatMatchedWindowBadge('2026-12-10', '2026-12-12', -2)).toBe('Available 10–12 Dec (-2 days)');
  });

  it('computes a deterministic upcoming weekend fallback window in chosen months', () => {
    const win = computeFallbackFlexWindow('weekend', ['2026-12'], new Date(2026, 10, 27));
    expect(win.nights).toBe(2);
    expect(win.checkIn).toBe('2026-12-04'); // First Friday in Dec 2026
    expect(win.checkOut).toBe('2026-12-06');
  });
});
