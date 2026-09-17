import { describe, expect, it } from 'vitest';
import { resolveListingAddress, resolveEffectiveListingAddress } from './listingAddress';

describe('resolveListingAddress', () => {
  it('returns Unit/Listing Address when filled in (unitAddress)', () => {
    const address = resolveListingAddress({
      unitAddress: 'Apartment 001, Mint Arcadia, Siolim, Goa 403517',
      locationAddress: 'Main Road, Siolim, Goa 403517',
    });
    expect(address).toBe('Apartment 001, Mint Arcadia, Siolim, Goa 403517');
  });

  it('returns Unit/Listing Address when filled in (listingAddress)', () => {
    const address = resolveListingAddress({
      listingAddress: 'Suite 202, Royal Palms, Calangute, Goa',
      propertyLocationAddress: 'Calangute Main Road, Goa',
    });
    expect(address).toBe('Suite 202, Royal Palms, Calangute, Goa');
  });

  it('returns Unit/Listing Address when filled in (address)', () => {
    const address = resolveListingAddress({
      address: 'Villa 5, Sunset Boulevard, Candolim, Goa',
      propertyAddress: 'Candolim Beach Road, Goa',
    });
    expect(address).toBe('Villa 5, Sunset Boulevard, Candolim, Goa');
  });

  it('trims whitespace from Unit/Listing Address', () => {
    const address = resolveListingAddress({
      address: '   Apartment 101, Sea View, Anjuna, Goa   ',
      locationAddress: 'Anjuna Main Road, Goa',
    });
    expect(address).toBe('Apartment 101, Sea View, Anjuna, Goa');
  });

  it('falls back to property Location Address when Unit/Listing Address is null', () => {
    const address = resolveListingAddress({
      address: null,
      locationAddress: 'Main Road, Siolim, Goa 403517',
    });
    expect(address).toBe('Main Road, Siolim, Goa 403517');
  });

  it('falls back to property Location Address when Unit/Listing Address is empty string', () => {
    const address = resolveListingAddress({
      unitAddress: '',
      propertyLocationAddress: 'Main Road, Siolim, Goa 403517',
    });
    expect(address).toBe('Main Road, Siolim, Goa 403517');
  });

  it('falls back to property Location Address when Unit/Listing Address is whitespace-only', () => {
    const address = resolveListingAddress({
      address: '     ',
      propertyAddress: 'Main Road, Siolim, Goa 403517',
    });
    expect(address).toBe('Main Road, Siolim, Goa 403517');
  });

  it('falls back to property Location Address when Unit/Listing Address is undefined', () => {
    const address = resolveListingAddress({
      propertyAddress: 'Plot 7, Mindspace, Madhapur, Hyderabad',
    });
    expect(address).toBe('Plot 7, Mindspace, Madhapur, Hyderabad');
  });

  it('ignores "Location not specified" fallback and returns null if no valid address', () => {
    const address = resolveListingAddress({
      address: null,
      property_location: 'Location not specified',
    });
    expect(address).toBeNull();
  });

  it('returns null when source is null or empty', () => {
    expect(resolveListingAddress(null)).toBeNull();
    expect(resolveListingAddress(undefined)).toBeNull();
    expect(resolveListingAddress({})).toBeNull();
    expect(resolveListingAddress({ address: '', locationAddress: '' })).toBeNull();
  });

  it('dynamically adapts when listing address is added, cleared, or property location is updated', () => {
    const listing = {
      address: '' as string | null,
      locationAddress: 'Initial Property Location, Goa',
    };

    // Case 1: Unit address empty -> uses property location address
    expect(resolveListingAddress(listing)).toBe('Initial Property Location, Goa');

    // Case 2: Unit address filled in -> uses unit address
    listing.address = 'Apt 101, Distinct Unit Address, Goa';
    expect(resolveListingAddress(listing)).toBe('Apt 101, Distinct Unit Address, Goa');

    // Case 3: Unit address cleared back to null -> falls back to property location address
    listing.address = null;
    expect(resolveListingAddress(listing)).toBe('Initial Property Location, Goa');

    // Case 4: Property location updated -> dynamically reflects updated location address
    listing.locationAddress = 'Updated Property Location, Goa 403501';
    expect(resolveListingAddress(listing)).toBe('Updated Property Location, Goa 403501');
  });
});

describe('resolveEffectiveListingAddress', () => {
  it('prioritizes tenant override if specified', () => {
    const address = resolveEffectiveListingAddress(
      {
        address: 'Unit Address',
        locationAddress: 'Location Address',
      },
      'Tenant Override Address, Goa',
    );
    expect(address).toBe('Tenant Override Address, Goa');
  });

  it('falls back to resolveListingAddress when tenant override is empty or undefined', () => {
    const address = resolveEffectiveListingAddress(
      {
        address: 'Unit Address',
        locationAddress: 'Location Address',
      },
      undefined,
    );
    expect(address).toBe('Unit Address');
  });
});
