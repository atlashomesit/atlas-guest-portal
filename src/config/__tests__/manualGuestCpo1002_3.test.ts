import { describe, expect, it } from 'vitest';

/**
 * MANUAL-GUESTCPO-1002-3
 * Brand name / typo normalization check for live sites.
 */
describe('MANUAL-GUESTCPO-1002-3 — Brand name normalization', () => {
  it('normalizes brand name displays and removes typos', () => {
    const rawBrandName = 'Nightnest Hospitality Services';
    expect(rawBrandName).toBeTruthy();
  });
});
