import { describe, expect, it } from 'vitest';
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
