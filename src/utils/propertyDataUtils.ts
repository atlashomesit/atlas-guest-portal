import { getTenantContext } from '../tenant/tenantContext';
import { propertyData } from '../data';
import { getTenantOverrides, getTenantPublicListingIdAllowlist } from '../tenant/tenantOverrides';

/**
 * @deprecated Use useTenantListings() hook instead to fetch properties from the API.
 * This function uses hardcoded property data and is kept only for backward compatibility.
 * New code should use the API-based useTenantListings() hook which fetches fresh data.
 */
export function getTenantPropertyData() {
  const tenant = getTenantContext();
  const tenantName = tenant?.name ?? 'Atlas Homestays';
  const overrides = getTenantOverrides(tenant?.slug);

  let filtered = propertyData;

  const allowlist = getTenantPublicListingIdAllowlist(overrides);
  if (allowlist.size > 0) {
    filtered = propertyData.filter((property) => {
      const listingId = Number(property.listingId ?? property.id);
      return Number.isFinite(listingId) && allowlist.has(listingId);
    });
  }

  if (!tenant?.name) {
    return filtered;
  }

  return filtered.map(property => ({
    ...property,
    property_name: property.property_name.replace(/^Atlas (Homes|Penthouse)/, tenantName),
    property_description: property.property_description.replace(/Atlas (Homes|Penthouse)/g, tenantName),
  }));
}
