import { describe, it, expect } from 'vitest';
import { SessionHealthTracker, computeCrashFreeRatePct } from './sessionHealthTracker';

describe('PERF-062 sessionHealthTracker', () => {
  it('tracks crash-free sessions and computes release crash-free rate', () => {
    const s1 = new SessionHealthTracker('2026.11.27', 'sess-1');
    const s2 = new SessionHealthTracker('2026.11.27', 'sess-2');
    s2.recordUnhandledError('TypeError: Cannot read properties of undefined');

    expect(s1.getSnapshot().crashFree).toBe(true);
    expect(s2.getSnapshot().crashFree).toBe(false);
    expect(computeCrashFreeRatePct([s1.getSnapshot(), s2.getSnapshot()])).toBe(50);
  });
});
