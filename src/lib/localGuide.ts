/**
 * TASK-102202 — Host's Favorite Spots local guide with Maps deep links.
 *
 * Done-when:
 * 1. Curated recommendations render category filter chips + distance.
 * 2. Venue cards open Google Maps navigation directly to the destination.
 */

export type GuideCategory = 'Breakfast' | 'Cafes' | 'Sunset Points' | 'Pharmacies';

export const GUIDE_CATEGORIES: GuideCategory[] = ['Breakfast', 'Cafes', 'Sunset Points', 'Pharmacies'];

export interface GuideSpot {
  id: string;
  name: string;
  category: GuideCategory;
  distanceKm: number;
  latitude: number;
  longitude: number;
  hostNote: string;
}

export function guideSpotMapsUrl(spot: Pick<GuideSpot, 'latitude' | 'longitude' | 'name'>): string {
  const dest = `${spot.latitude},${spot.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&destination_place_id=${encodeURIComponent(spot.name)}&travelmode=driving`;
}

export function filterGuideSpots(spots: GuideSpot[], category: GuideCategory | 'All'): GuideSpot[] {
  const sorted = [...spots].sort((a, b) => a.distanceKm - b.distanceKm);
  if (category === 'All') return sorted;
  return sorted.filter((s) => s.category === category);
}
