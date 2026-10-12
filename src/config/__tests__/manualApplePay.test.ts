import { describe, expect, it } from 'vitest';

/**
 * MANUAL-APPLEPAY-1006-1
 * Turn on Apple Pay for Atlas's own web checkout, then decide whether guests on host sites get it
 */
describe('MANUAL-APPLEPAY-1006-1 — Apple Pay checkout options', () => {
  it('defaults Apple Pay host site checkout enablement to false until founder decision', () => {
    const isApplePayEnabledForHostSites = false;
    expect(isApplePayEnabledForHostSites).toBe(false);
  });
});
