import { describe, it, expect } from 'vitest';
import { getListingDisplayName } from './listingDisplayName';

describe('getListingDisplayName — TASK-2635 stability + cross-tenant safety', () => {
  it('maps an Atlas SKU to its friendly name', () => {
    expect(getListingDisplayName(5, 'Atlas501_PH')).toBe('Penthouse 501');
    expect(getListingDisplayName(undefined, 'atlas301')).toBe('Studio 301');
  });

  it('returns the same friendly name whether the upstream field is SKU or already-friendly', () => {
    // The prod flip was "Atlas501_PH" on one visit, "Penthouse 501" on the next — both
    // describe the same unit and must collapse to one stable value.
    const fromSku = getListingDisplayName(5, 'Atlas501_PH');
    const fromFriendly = getListingDisplayName(5, 'Penthouse 501');
    expect(fromSku).toBe(fromFriendly);
    expect(fromSku).toBe('Penthouse 501');
  });

  it('is independent of the (sometimes ambiguous) id arg for an Atlas SKU', () => {
    // Even if a caller passes a listing id that collides with a floor-number map key,
    // the SKU in rawName wins, so the same listing never renders two different names.
    expect(getListingDisplayName(301, 'Atlas501_PH')).toBe('Penthouse 501');
    expect(getListingDisplayName(0, 'Atlas501_PH')).toBe('Penthouse 501');
  });

  it('never remaps a cross-tenant name onto an Atlas unit name', () => {
    // Marketplace/search span all tenants; a non-Atlas listing whose name happens to
    // contain 501 must keep its own name.
    expect(getListingDisplayName(7, 'Sea View 501')).toBe('Sea View 501');
    expect(getListingDisplayName(7, 'Penthouse 501')).toBe('Penthouse 501');
  });

  it('falls back to a floor-number id lookup when no Atlas SKU is present', () => {
    expect(getListingDisplayName(201, 'Some Room')).toBe('Suite 201');
  });

  it('falls back to the raw name for unknown listings', () => {
    expect(getListingDisplayName(9999, 'Garden Cottage')).toBe('Garden Cottage');
  });
});
