import { describe, it, expect } from 'vitest';
import { urgencyBadges } from './urgencyBadges';

describe('TASK-102262 urgency badges', () => {
  it('shows a demand badge from measured viewer counts', () => {
    expect(urgencyBadges({ recentViewers: 4, unitsRemaining: 9 })).toEqual([
      { kind: 'demand', text: 'High demand — 4 guests looking at these dates' },
    ]);
  });

  it('shows scarcity only for genuinely low remaining inventory', () => {
    expect(urgencyBadges({ recentViewers: 0, unitsRemaining: 1 })[0].text).toContain('Only 1 villa');
    expect(urgencyBadges({ recentViewers: 0, unitsRemaining: 9 })).toEqual([]);
  });

  it('never fabricates badges without evidence', () => {
    expect(urgencyBadges({ recentViewers: 1, unitsRemaining: 0 })).toEqual([]);
    expect(urgencyBadges({ recentViewers: 2, unitsRemaining: 5 })).toEqual([]);
  });
});
