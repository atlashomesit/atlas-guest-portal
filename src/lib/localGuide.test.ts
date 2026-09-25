import { describe, it, expect } from 'vitest';
import { filterGuideSpots, guideSpotMapsUrl, type GuideSpot } from './localGuide';

const SPOTS: GuideSpot[] = [
  { id: 'a', name: 'Cafe Far', category: 'Cafes', distanceKm: 3, latitude: 15.5, longitude: 73.8, hostNote: '' },
  { id: 'b', name: 'Cafe Near', category: 'Cafes', distanceKm: 0.4, latitude: 15.51, longitude: 73.81, hostNote: '' },
  { id: 'c', name: 'Sunset Rock', category: 'Sunset Points', distanceKm: 1.2, latitude: 15.49, longitude: 73.79, hostNote: '' },
];

describe('TASK-102202 local guide + Maps links', () => {
  it('opens Google Maps navigation to the venue coordinates', () => {
    const url = guideSpotMapsUrl(SPOTS[1]);
    expect(url.startsWith('https://www.google.com/maps/dir/?api=1')).toBe(true);
    expect(url).toContain(encodeURIComponent('15.51,73.81'));
  });

  it('filters by category chip and sorts by distance', () => {
    expect(filterGuideSpots(SPOTS, 'Cafes').map((s) => s.id)).toEqual(['b', 'a']);
    expect(filterGuideSpots(SPOTS, 'All').map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });
});
