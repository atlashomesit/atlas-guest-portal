import { describe, expect, it } from 'vitest';
import { splitIsoRange } from './availabilityRatesClient';

/**
 * TASK-8350 capped /api/pricing/availability-rates at 60 days per request. The booking widget
 * asks for 3 months (~91 days), which 400'd and left the guest calendar empty with console
 * errors (caught by tests/guest-photo-api-call-count.e2e.spec.ts on the 2026-09-04 qa gate).
 * These pin the split so the cap cannot be exceeded again, and so the window maths cannot
 * silently drop or duplicate a day.
 */
function daysBetween(a: string, b: string): number {
  const [sy, sm, sd] = a.split('-').map(Number);
  const [ey, em, ed] = b.split('-').map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000);
}

describe('splitIsoRange', () => {
  it('splits the real 3-month widget window so no request exceeds the 60-day cap', () => {
    const windows = splitIsoRange('2026-09-01', '2026-12-01', 60);
    expect(windows.length).toBeGreaterThan(1);
    for (const w of windows) expect(daysBetween(w.start, w.end)).toBeLessThanOrEqual(60);
  });

  it('covers the full range with no gap and no overlap', () => {
    const windows = splitIsoRange('2026-09-01', '2026-12-01', 60);
    expect(windows[0].start).toBe('2026-09-01');
    expect(windows[windows.length - 1].end).toBe('2026-12-01');
    for (let i = 1; i < windows.length; i += 1) {
      // exactly one day after the previous end — contiguous, and never the same day twice
      expect(daysBetween(windows[i - 1].end, windows[i].start)).toBe(1);
    }
  });

  it('leaves a range already within the cap as a single request', () => {
    expect(splitIsoRange('2026-09-01', '2026-10-01', 60)).toEqual([
      { start: '2026-09-01', end: '2026-10-01' },
    ]);
  });

  it('does not loop forever on a degenerate cap, and still covers the range', () => {
    // maxDays 0 floors to a 1-day step, so this terminates rather than spinning.
    const windows = splitIsoRange('2026-09-01', '2026-09-10', 0);
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.length).toBeLessThan(100);
    expect(windows[0].start).toBe('2026-09-01');
    expect(windows[windows.length - 1].end).toBe('2026-09-10');
    for (let i = 1; i < windows.length; i += 1) {
      expect(daysBetween(windows[i - 1].end, windows[i].start)).toBe(1);
    }
  });
});
