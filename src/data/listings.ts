import { propertyData } from './propertyData';

export interface Listing {
  id: string | number;
  title: string;
  subtitle?: string;
  unitType?: string;
  featured?: boolean;
}

export const LISTINGS: Listing[] = propertyData.map((property, index) => ({
  id: property.id,
  title: property.property_name,
  subtitle: property.property_description.slice(0, 100) + '...',
  unitType: property.unitType,
  featured: index === 0, // Make the first one featured
}));

