import { describe, it, expect } from 'vitest';
import { bandedMonth, cheapestDay } from './flexibleDates';

const RATES = [
  { dateIso: '2026-11-01', nightlyInr: 8000 },
  { dateIso: '2026-11-02', nightlyInr: 11000 },
  { dateIso: '2026-11-03', nightlyInr: 16000 },
];

describe('TASK-102267 flexible-dates pricing matrix', () => {
  it('finds the lowest-price day in the month view', () => {
    expect(cheapestDay(RATES)?.dateIso).toBe('2026-11-01');
    expect(cheapestDay([])).toBeNull();
  });

  it('color-codes green lowest through amber peak days', () => {
    expect(bandedMonth(RATES).map((d) => d.band)).toEqual(['lowest', 'mid', 'peak']);
    expect(bandedMonth(RATES)[0].style).toContain('green');
    expect(bandedMonth(RATES)[2].style).toContain('amber');
  });
});
