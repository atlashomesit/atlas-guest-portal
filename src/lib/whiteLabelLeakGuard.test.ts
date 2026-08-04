import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { getListingDisplayName } from '../lib/listingDisplayName';
import { mapDtoToProperty } from '../hooks/useTenantListings';

vi.mock('../tenant/tenantContext', () => ({
  getTenantContext: vi.fn(),
}));

vi.mock('../tenant/tenantOverrides', () => ({
  getTenantOverrides: vi.fn(() => ({})),
  shouldHideAtlasBranding: vi.fn(),
}));

import { getTenantContext } from '../tenant/tenantContext';
import { shouldHideAtlasBranding } from '../tenant/tenantOverrides';

/** TASK-7194: strings that must never appear on a white-label tenant surface. */
const WHITE_LABEL_BANNED = [
  'KPHB',
  'Kukatpally',
  'Penthouse 501',
  'HITECity',
  'Jubilee Hills',
] as const;

describe('white-label string leak guard (TASK-7194)', () => {
  beforeEach(() => {
    vi.mocked(getTenantContext).mockReturnValue({ slug: 'staybycf', name: 'Stay by CF' });
    vi.mocked(shouldHideAtlasBranding).mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('mapDtoToProperty omits Hyderabad when address is absent', () => {
    const property = mapDtoToProperty({
      id: 501,
      name: 'Oakmont 2bhk - 501',
      propertyName: 'Oakmont',
      maxGuests: 4,
      photoUrls: [],
      propertyAddress: null,
    });
    expect(property.property_location).toBe('');
    for (const banned of WHITE_LABEL_BANNED) {
      expect(property.property_location).not.toContain(banned);
    }
  });

  it('getListingDisplayName keeps tenant listing names on white-label slugs', () => {
    expect(getListingDisplayName(501, 'Oakmont 2bhk - 501')).toBe('Oakmont 2bhk - 501');
    expect(getListingDisplayName(501, 'Oakmont 2bhk - 501')).not.toBe('Penthouse 501');
  });
});
