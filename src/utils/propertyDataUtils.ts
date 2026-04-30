import { getTenantContext } from '../tenant/tenantContext';
import { propertyData } from '../data';

export function getTenantPropertyData() {
  const tenant = getTenantContext();
  const tenantName = tenant?.name ?? 'Atlas Homestays';

  if (!tenant?.name) {
    return propertyData;
  }

  return propertyData.map(property => ({
    ...property,
    property_name: property.property_name.replace(/^Atlas (Homes|Penthouse)/, tenantName),
    property_description: property.property_description.replace(/Atlas (Homes|Penthouse)/g, tenantName),
  }));
}
