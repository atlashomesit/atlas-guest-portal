export interface ListingAddressSource {
  unitAddress?: string | null;
  listingAddress?: string | null;
  address?: string | null;
  locationAddress?: string | null;
  propertyLocationAddress?: string | null;
  propertyAddress?: string | null;
  property_address?: string | null;
  property_location?: string | null;
}

/**
 * Resolves the display listing address for the Guest Portal.
 *
 * Requirement:
 * 1. In Rooms & Units, there is a Unit/Listing Address field.
 * 2. If the Unit/Listing Address is filled in, display that address as the Listing Address in the Guest Portal.
 * 3. If the Unit/Listing Address is empty or not provided, use the property's Location Address
 *    (the address entered in the initial Location section) as the Listing Address in the Guest Portal.
 * 4. Apply this logic dynamically so the Guest Portal always displays the correct address.
 */
export function resolveListingAddress(
  source: ListingAddressSource | null | undefined,
): string | null {
  if (!source) return null;

  // 1. Check unit/listing address field
  const unitCandidate = source.unitAddress ?? source.listingAddress ?? source.address;
  if (typeof unitCandidate === 'string' && unitCandidate.trim().length > 0) {
    return unitCandidate.trim();
  }

  // 2. Fall back to property's location address
  const locationCandidate =
    source.locationAddress ??
    source.propertyLocationAddress ??
    source.propertyAddress ??
    source.property_address ??
    source.property_location;

  if (
    typeof locationCandidate === 'string' &&
    locationCandidate.trim().length > 0 &&
    locationCandidate.trim().toLowerCase() !== 'location not specified'
  ) {
    return locationCandidate.trim();
  }

  return null;
}

/**
 * Resolves the effective listing address, taking into account any explicit tenant override.
 */
export function resolveEffectiveListingAddress(
  source: ListingAddressSource | null | undefined,
  overrideAddress?: string | null,
): string | null {
  if (overrideAddress && overrideAddress.trim().length > 0) {
    return overrideAddress.trim();
  }
  return resolveListingAddress(source);
}
