import { afterEach, describe, expect, it } from 'vitest';
import { formatCurrency, formatDateForDisplay, formatDateForInput, formatHumanDate, parseDate } from './formatting';

describe('parseDate', () => {
  it('returns a valid Date for ISO input', () => {
    const date = parseDate('2024-02-29');
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2024);
    expect(date?.getMonth()).toBe(1);
    expect(date?.getDate()).toBe(29);
  });

  it('returns null for impossible dates', () => {
    expect(parseDate('2024-02-30')).toBeNull();
    expect(parseDate('2023-02-29')).toBeNull();
    expect(parseDate('2024-13-01')).toBeNull();
  });

  it('returns null for invalid inputs', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate('not-a-date')).toBeNull();
  });
});

describe('formatDateForInput', () => {
  it('formats a valid date to yyyy-mm-dd', () => {
    const date = new Date(2024, 0, 5);
    expect(formatDateForInput(date)).toBe('2024-01-05');
  });

  it('throws for invalid dates', () => {
    expect(() => formatDateForInput(new Date('invalid'))).toThrowError('Cannot format invalid date');
  });
});

describe('formatDateForDisplay', () => {
  it('formats a date string to dd-mm-yyyy', () => {
    expect(formatDateForDisplay('2024-12-01')).toBe('01-12-2024');
  });

  it('uses the fallback for invalid dates', () => {
    expect(formatDateForDisplay('2024-02-30', 'Invalid')).toBe('Invalid');
  });
});

describe('formatHumanDate', () => {
  it('formats to a human readable string', () => {
    expect(formatHumanDate('2024-03-15')).toBe('15 Mar 2024');
  });

  it('respects the fallback for null values', () => {
    expect(formatHumanDate(null, { fallback: 'Missing' })).toBe('Missing');
  });
});

// TASK-6061: a booking's check-in/check-out is a date-only YYYY-MM-DD calendar day, not an
// instant. `new Date("2026-08-03")` parses as UTC midnight per spec; reading it back (or
// formatting it) with the browser's LOCAL time zone shifts the rendered day backward for any
// viewer west of UTC. IST/European `TZ`s never surface this (UTC midnight is still the same
// calendar day locally), which is exactly how it shipped unnoticed — so these tests force a
// western `TZ` the way no pre-existing test in this file did.
describe('date-only parsing is time-zone invariant (TASK-6061)', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('renders the same calendar day in America/Los_Angeles (UTC-7/8) as in UTC', () => {
    process.env.TZ = 'America/Los_Angeles';
    expect(formatHumanDate('2026-08-03')).toBe('03 Aug 2026');
    expect(formatDateForDisplay('2026-08-03')).toBe('03-08-2026');

    process.env.TZ = 'UTC';
    expect(formatHumanDate('2026-08-03')).toBe('03 Aug 2026');
    expect(formatDateForDisplay('2026-08-03')).toBe('03-08-2026');
  });

  it('renders the same calendar day in Pacific/Kiritimati (UTC+14, east of UTC) as in UTC', () => {
    process.env.TZ = 'Pacific/Kiritimati';
    expect(formatHumanDate('2026-08-03')).toBe('03 Aug 2026');

    process.env.TZ = 'UTC';
    expect(formatHumanDate('2026-08-03')).toBe('03 Aug 2026');
  });

  it('parseDate itself yields the same year/month/date fields regardless of TZ', () => {
    process.env.TZ = 'America/Los_Angeles';
    const laDate = parseDate('2026-08-03');
    expect(laDate?.getFullYear()).toBe(2026);
    expect(laDate?.getMonth()).toBe(7); // August, 0-indexed
    expect(laDate?.getDate()).toBe(3);

    process.env.TZ = 'Pacific/Kiritimati';
    const kiritimatiDate = parseDate('2026-08-03');
    expect(kiritimatiDate?.getFullYear()).toBe(2026);
    expect(kiritimatiDate?.getMonth()).toBe(7);
    expect(kiritimatiDate?.getDate()).toBe(3);
  });

  it('still rejects an impossible calendar date under a western TZ', () => {
    process.env.TZ = 'America/Los_Angeles';
    expect(parseDate('2026-02-30')).toBeNull();
    expect(formatDateForDisplay('2026-02-30', 'Invalid')).toBe('Invalid');
  });
});

describe('formatCurrency', () => {
  it('formats positive numbers with currency', () => {
    expect(formatCurrency(1234)).toBe('₹1,234');
  });

  it('handles non-finite inputs gracefully', () => {
    expect(formatCurrency(Number.NaN)).toBe('₹0');
  });

  it('supports custom locales and currencies', () => {
    expect(
      formatCurrency(1234.5, {
        currency: 'USD',
        locale: 'en-US',
        maximumFractionDigits: 2,
      }),
    ).toBe('$1,234.50');
  });
});
