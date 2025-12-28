import type { UnitType } from "../config/pricing.config";

export type Listing = {
  id: string;        // "101", "102", "302", "501", ...
  title: string;
  subtitle?: string;
  featured?: boolean; // penthouse true
  unitType: UnitType;
};

// Add/keep existing units here; ensure 501 exists and is featured
export const LISTINGS: Listing[] = [
  { id: '501', title: 'Penthouse 501', subtitle: 'Hyderabad', featured: true, unitType: 'penthouse' },
  { id: '201', title: 'Room 201', subtitle: 'Hyderabad', unitType: '1bhk' },
  { id: '202', title: 'Room 202', subtitle: 'Hyderabad', unitType: '1bhk' },
  { id: '301', title: 'Room 301', subtitle: 'Hyderabad', unitType: '1bhk' },
  { id: '101', title: 'Room 101', subtitle: 'Hyderabad', unitType: '1bhk' },
  { id: '102', title: 'Room 102', subtitle: 'Hyderabad', unitType: '1bhk' },
  { id: '302', title: 'Room 302', subtitle: 'Hyderabad', unitType: '1bhk' },
];
