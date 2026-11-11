import { describe, expect, it } from 'vitest';
import { getTenantOverrides } from '../../tenant/tenantOverrides';

/**
 * MANUAL-GUESTCPO-1002-2
 * Sahil Goyal (t23) site resolution guard.
 */
describe('MANUAL-GUESTCPO-1002-2 — Sahil Goyal (t23) site resolution', () => {
  it('handles sahil-goyal tenant overrides gracefully', () => {
    const overrides = getTenantOverrides('sahil-goyal');
    expect(overrides).toBeDefined();
  });
});
