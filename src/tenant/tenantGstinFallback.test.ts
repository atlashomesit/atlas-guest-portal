import { describe, expect, it } from 'vitest';
import { getTenantOverrides } from './tenantOverrides';

/**
 * MANUAL-20260916-ATLAS-HOMES-GSTIN
 * Ensures guest portal tenant context handles missing supplier GSTIN gracefully
 * while GST registration / CA confirmation is pending.
 */
describe('MANUAL-20260916-ATLAS-HOMES-GSTIN — supplier GSTIN fallback', () => {
  it('gracefully handles undefined supplier GSTIN for atlas tenant overrides', () => {
    const atlasOverrides = getTenantOverrides('atlas');
    expect(atlasOverrides.gstin).toBeUndefined();
  });
});
