import { describe, expect, it } from 'vitest';
import { getTenantListingAddress, getTenantOverrides } from './tenantOverrides';
import { mapDtoToProperty } from '@/hooks/useTenantListings';
import { _setTenantContextForTests, _resetTenantContextForTests } from './tenantContext';
import type { PublicListing } from '@/api/listingClient';

describe('tenant listing addresses — goan-hideaway overrides', () => {
  const overrides = getTenantOverrides('goan-hideaway');

  it('resolves correct distinct addresses for all 5 Goan Hideaway listings', () => {
    expect(getTenantListingAddress(overrides, 399)).toBe(
      'Apartment 001, Mint Arcadia, Baman Waddo, Near Shri Laxmi Narayan Temple, Siolim, Goa 403517',
    );
    expect(getTenantListingAddress(overrides, 532)).toBe(
      'C-201, Second Floor, Areia De Goa, Opposite Riviera Palms, Bardez, Arpora, Goa 403516',
    );
    expect(getTenantListingAddress(overrides, 533)).toBe(
      'Apartment 2208, Riviera Foothills, Riviera Foothills Road, Arpora, Goa 403507',
    );
    expect(getTenantListingAddress(overrides, 535)).toBe(
      'Apartment 1111, Riviera Foothills, Riviera Foothills Road, Arpora, Goa 403507',
    );
    expect(getTenantListingAddress(overrides, 536)).toBe(
      'Apartment 2009A, Riviera Foothills, Riviera Foothills Road, Arpora, Goa 403507',
    );
  });

  it('returns undefined for unconfigured listing IDs or other tenants', () => {
    expect(getTenantListingAddress(overrides, 9999)).toBeUndefined();
    expect(getTenantListingAddress(overrides, null)).toBeUndefined();
    expect(getTenantListingAddress(overrides, undefined)).toBeUndefined();

    const staybycfOverrides = getTenantOverrides('staybycf');
    expect(getTenantListingAddress(staybycfOverrides, 399)).toBeUndefined();

    const atlasOverrides = getTenantOverrides('atlas');
    expect(getTenantListingAddress(atlasOverrides, 399)).toBeUndefined();
  });

  it('mapDtoToProperty uses listing address override when active tenant is goan-hideaway', () => {
    _setTenantContextForTests({
      slug: 'goan-hideaway',
      name: 'Goan Hideaway',
    });

    const dto: PublicListing = {
      id: 399,
      propertyId: 153,
      propertyName: 'Goan Hideaway',
      name: 'Uno Goan Hideaway',
      maxGuests: 4,
      propertyAddress: 'Apartment #2206, Riviera Foothills, Riviera Foothills Road, Arpora, goa, Goa, 403519',
    };

    const prop = mapDtoToProperty(dto);
    expect(prop.property_location).toBe(
      'Apartment 001, Mint Arcadia, Baman Waddo, Near Shri Laxmi Narayan Temple, Siolim, Goa 403517',
    );
    expect(prop.propertyAddress).toBe(
      'Apartment 001, Mint Arcadia, Baman Waddo, Near Shri Laxmi Narayan Temple, Siolim, Goa 403517',
    );
    _resetTenantContextForTests();
  });
});
