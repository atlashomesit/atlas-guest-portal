import { describe, it, expect } from 'vitest';
import { getSmartLockStatus, formatSmartLockCountdown, displaySmartLockPin } from './smartLockCountdown';

describe('TASK-102199 smart lock PIN countdown', () => {
  it('stays locked with a countdown before check-in time', () => {
    const s = getSmartLockStatus(1700000000000, 1699999900000);
    expect(s.state).toBe('locked');
    expect(s.secondsRemaining).toBe(100);
    expect(s.copyEnabled).toBe(false);
  });

  it('reveals the PIN at/after check-in time with copy enabled', () => {
    const s = getSmartLockStatus(1700000000000, 1700000000000);
    expect(s.state).toBe('revealed');
    expect(s.secondsRemaining).toBe(0);
    expect(s.copyEnabled).toBe(true);
  });

  it('formats the countdown label and masks the PIN while locked', () => {
    expect(formatSmartLockCountdown(3661)).toBe('01:01:01');
    const locked = getSmartLockStatus(2000, 1000);
    expect(displaySmartLockPin('482913', locked)).toBe('••••••');
    const open = getSmartLockStatus(1000, 2000);
    expect(displaySmartLockPin('482913', open)).toBe('482913');
  });
});
