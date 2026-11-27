import { describe, expect, it } from 'vitest';
import {
  computeHaversineKm,
  filterDestinations,
  formatDistanceLabel,
  POPULAR_DESTINATIONS,
  POPULAR_LANDMARKS,
} from './destinationData';

describe('destinationData landmarks & proximity (MKT-060)', () => {
  it('finds Indian landmarks and neighbourhoods in destination autocomplete', () => {
    const hitec = filterDestinations('HITEC', [], POPULAR_DESTINATIONS, POPULAR_LANDMARKS);
    expect(hitec.some((d) => d.label === 'HITEC City' && d.kind === 'landmark' && typeof d.lat === 'number')).toBe(true);

    const baga = filterDestinations('Baga', [], POPULAR_DESTINATIONS, POPULAR_LANDMARKS);
    expect(baga.some((d) => d.label === 'Baga Beach' && d.city === 'Goa')).toBe(true);
  });

  it('computes Haversine distance in km to 1 decimal place', () => {
    // HITEC City (17.4435, 78.3772) to Gachibowli (17.4401, 78.3489) is ~3.0 km
    const km = computeHaversineKm(17.4435, 78.3772, 17.4401, 78.3489);
    expect(km).toBeGreaterThan(2.5);
    expect(km).toBeLessThan(3.5);
    expect(computeHaversineKm(17.4435, 78.3772, 17.4435, 78.3772)).toBe(0);
  });

  it('formats card distance label cleanly', () => {
    expect(formatDistanceLabel(1.8, 'HITEC City')).toBe('1.8 km from HITEC City');
    expect(formatDistanceLabel(3, 'Baga Beach')).toBe('3.0 km from Baga Beach');
  });
});
