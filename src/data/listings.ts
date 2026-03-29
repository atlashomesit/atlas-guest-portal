import { propertyData } from './propertyData';
import { compareAtlasHomesBuildingOrder } from '../utils/atlasHomesBuildingOrder';

export interface Listing {
  id: string | number;
  title: string;
  subtitle?: string;
  unitType?: string;
  featured?: boolean;
}

const orderedProperties = [...propertyData].sort((a, b) =>
  compareAtlasHomesBuildingOrder(a.id, b.id),
);

export const LISTINGS: Listing[] = orderedProperties.map((property) => ({
  id: property.id,
  title: property.property_name,
  subtitle: property.property_description.slice(0, 100) + '...',
  unitType: property.unitType,
  featured: property.id === 501,
}));
