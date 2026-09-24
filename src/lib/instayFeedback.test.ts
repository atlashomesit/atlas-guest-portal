import { describe, it, expect } from 'vitest';
import { evaluateStayPulse, shouldShowStayPulse, stayDayNumber } from './instayFeedback';

describe('TASK-102207 day-2 in-stay feedback pulse', () => {
  it('prompts only on the morning of day 2', () => {
    expect(stayDayNumber('2026-10-01', '2026-10-02')).toBe(2);
    expect(shouldShowStayPulse('2026-10-01', '2026-10-02', false)).toBe(true);
    expect(shouldShowStayPulse('2026-10-01', '2026-10-03', false)).toBe(false);
    expect(shouldShowStayPulse('2026-10-01', '2026-10-02', true)).toBe(false);
  });

  it('escalates ratings of 3 or below for service recovery', () => {
    expect(evaluateStayPulse(3).needsRecovery).toBe(true);
    expect(evaluateStayPulse(2).needsRecovery).toBe(true);
    expect(evaluateStayPulse(4).needsRecovery).toBe(false);
    expect(evaluateStayPulse(5).needsRecovery).toBe(false);
  });
});
