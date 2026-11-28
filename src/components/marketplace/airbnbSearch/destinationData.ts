import type { DestinationOption } from './types';

export const POPULAR_DESTINATIONS: DestinationOption[] = [
  { label: 'Goa', region: 'India', kind: 'popular' },
  { label: 'Coorg', region: 'India', kind: 'popular' },
  { label: 'Manali', region: 'India', kind: 'popular' },
  { label: 'Hyderabad', region: 'India', kind: 'popular' },
  { label: 'Bengaluru', region: 'India', kind: 'popular' },
  { label: 'Gurugram', region: 'India', kind: 'popular' },
  { label: 'Nashik', region: 'India', kind: 'popular' },
];

/**
 * MKT-060: Curated Indian landmarks, beaches, temples, and neighbourhoods for
 * proximity search (`?nearLat=&nearLng=&nearLabel=`).
 */
export const POPULAR_LANDMARKS: DestinationOption[] = [
  { label: 'HITEC City', region: 'Hyderabad · Tech Park', kind: 'landmark', city: 'Hyderabad', lat: 17.4435, lng: 78.3772 },
  { label: 'Gachibowli', region: 'Hyderabad · Neighbourhood', kind: 'landmark', city: 'Hyderabad', lat: 17.4401, lng: 78.3489 },
  { label: 'Madhapur', region: 'Hyderabad · Neighbourhood', kind: 'landmark', city: 'Hyderabad', lat: 17.4483, lng: 78.3915 },
  { label: 'Banjara Hills', region: 'Hyderabad · Neighbourhood', kind: 'landmark', city: 'Hyderabad', lat: 17.4156, lng: 78.4347 },
  { label: 'Baga Beach', region: 'Goa · Beach', kind: 'landmark', city: 'Goa', lat: 15.5553, lng: 73.7517 },
  { label: 'Calangute Beach', region: 'Goa · Beach', kind: 'landmark', city: 'Goa', lat: 15.5439, lng: 73.7553 },
  { label: 'Candolim Beach', region: 'Goa · Beach', kind: 'landmark', city: 'Goa', lat: 15.5181, lng: 73.7626 },
  { label: 'Whitefield', region: 'Bengaluru · Tech Park', kind: 'landmark', city: 'Bengaluru', lat: 12.9698, lng: 77.7500 },
  { label: 'Indiranagar', region: 'Bengaluru · Neighbourhood', kind: 'landmark', city: 'Bengaluru', lat: 12.9784, lng: 77.6408 },
  { label: 'Koramangala', region: 'Bengaluru · Neighbourhood', kind: 'landmark', city: 'Bengaluru', lat: 12.9352, lng: 77.6245 },
  { label: 'Tirupati Temple', region: 'Tirupati · Temple', kind: 'landmark', city: 'Tirupati', lat: 13.6833, lng: 79.3472 },
  { label: 'Mall Road Manali', region: 'Manali · Landmark', kind: 'landmark', city: 'Manali', lat: 32.2432, lng: 77.1892 },
  { label: 'Madikeri', region: 'Coorg · Town Centre', kind: 'landmark', city: 'Coorg', lat: 12.4244, lng: 75.7382 },
  { label: 'Cyber City', region: 'Gurugram · Tech Park', kind: 'landmark', city: 'Gurugram', lat: 28.4950, lng: 77.0895 },
  { label: 'Bandra West', region: 'Mumbai · Neighbourhood', kind: 'landmark', city: 'Mumbai', lat: 19.0596, lng: 72.8295 },
  { label: 'Connaught Place', region: 'New Delhi · Landmark', kind: 'landmark', city: 'New Delhi', lat: 28.6315, lng: 77.2167 },
];

/**
 * Computes great-circle Haversine distance in kilometres between two WGS-84 points,
 * rounded to 1 decimal place.
 */
export function computeHaversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function formatDistanceLabel(km: number, nearLabel: string): string {
  const rounded = Math.round(km * 10) / 10;
  const formatted = Number.isInteger(rounded) ? `${rounded.toFixed(1)}` : String(rounded);
  return `${formatted} km from ${nearLabel.trim()}`;
}

export function filterDestinations(
  query: string,
  recent: DestinationOption[],
  pool: DestinationOption[] = POPULAR_DESTINATIONS,
  landmarks: DestinationOption[] = POPULAR_LANDMARKS,
): DestinationOption[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [
      ...recent,
      ...pool.filter((p) => !recent.some((r) => r.label.toLowerCase() === p.label.toLowerCase())),
      ...landmarks.slice(0, 4),
    ];
  }
  const all = [...recent, ...pool, ...landmarks];
  const seen = new Set<string>();
  return all.filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    const haystack = `${item.label} ${item.region} ${item.city ?? ''}`.toLowerCase();
    return haystack.includes(q);
  });
}
