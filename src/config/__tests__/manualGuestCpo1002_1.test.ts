import { describe, expect, it } from 'vitest';
import { getTenantOverrides } from '../../tenant/tenantOverrides';

/**
 * MANUAL-GUESTCPO-1002-1
 * Goan Hideaway (t99) site resolution fallback guard.
 */
describe('MANUAL-GUESTCPO-1002-1 — Goan Hideaway site resolution', () => {
  it('handles Goan Hideaway (t99) fallback gracefully', () => {
    const overrides = getTenantOverrides('goan-hideaway');
    expect(overrides).toBeDefined();
  });
});
