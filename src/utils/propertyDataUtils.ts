import { getTenantContext } from '../tenant/tenantContext';
import { propertyData } from '../data';
import { getTenantOverrides } from '../tenant/tenantOverrides';

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

  // Filter to only allowed properties if tenant has a homes list defined
  if (overrides.homes && overrides.homes.length > 0) {
    const allowedRoomNos = new Set(overrides.homes.map(home => home.roomNo));
    filtered = propertyData.filter(property => {
      const roomNo = String(property.room_no || property.id || '');
      return allowedRoomNos.has(roomNo);
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
