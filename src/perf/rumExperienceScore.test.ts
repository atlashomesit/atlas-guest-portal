import { describe, it, expect } from 'vitest';
import {
  computeCompositeExperienceScore,
  segmentExperienceScores,
} from './rumExperienceScore';

describe('PERF-067 rumExperienceScore', () => {
  it('computes composite experience score and segments by device class and network speed', () => {
    expect(computeCompositeExperienceScore({ lcpMs: 1800, inpMs: 120, cls: 0.02 })).toBe(100);
    expect(computeCompositeExperienceScore({ lcpMs: 5000, inpMs: 600, cls: 0.3 })).toBe(40);

    const segmented = segmentExperienceScores([
      { lcpMs: 2000, inpMs: 150, cls: 0.05, deviceClass: 'mobile', networkSpeed: '4g' },
      { lcpMs: 4500, inpMs: 550, cls: 0.3, deviceClass: 'mobile', networkSpeed: '3g' },
    ]);
    expect(segmented['mobile:4g'].avgScore).toBe(100);
    expect(segmented['mobile:3g'].avgScore).toBe(40);
  });
});
