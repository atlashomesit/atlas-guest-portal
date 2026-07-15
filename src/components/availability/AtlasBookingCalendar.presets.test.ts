import { describe, it, expect } from 'vitest';
import { computePreset } from './AtlasBookingCalendar';

// TASK-4847: "this weekend" / "next weekend" preset date-math regression tests.
// Deterministic fixed dates (local-constructed, no `new Date()` "now"):
//   2026-01-02 = Friday, 2026-01-03 = Saturday, 2026-01-04 = Sunday, 2026-01-05 = Monday.
const FRIDAY = new Date(2026, 0, 2);
const SATURDAY = new Date(2026, 0, 3);
const SUNDAY = new Date(2026, 0, 4);
const MONDAY = new Date(2026, 0, 5);

/** Local YYYY-MM-DD (the returned Dates are local-constructed, so read local fields). */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('AtlasBookingCalendar computePreset — weekend presets (TASK-4847)', () => {
  it('this-weekend: today IS Friday → this Friday (not next weekend)', () => {
    expect(ymd(computePreset('this-weekend', FRIDAY)!.startDate)).toBe('2026-01-02');
  });

  it('this-weekend: today IS Saturday → this Saturday', () => {
    expect(ymd(computePreset('this-weekend', SATURDAY)!.startDate)).toBe('2026-01-03');
  });

  it('this-weekend: today IS Sunday → the coming Friday', () => {
    expect(ymd(computePreset('this-weekend', SUNDAY)!.startDate)).toBe('2026-01-09');
  });

  it('this-weekend: today IS Monday → the coming Friday', () => {
    expect(ymd(computePreset('this-weekend', MONDAY)!.startDate)).toBe('2026-01-09');
  });

  it('next-weekend: today IS Friday → this Friday + 7 (not the weekend after next)', () => {
    expect(ymd(computePreset('next-weekend', FRIDAY)!.startDate)).toBe('2026-01-09');
  });

  it('next-weekend: today IS Monday → coming Friday + 7', () => {
    expect(ymd(computePreset('next-weekend', MONDAY)!.startDate)).toBe('2026-01-16');
  });
});
