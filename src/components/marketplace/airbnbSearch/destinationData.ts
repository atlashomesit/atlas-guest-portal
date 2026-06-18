import type { DestinationOption } from './types';

export const POPULAR_DESTINATIONS: DestinationOption[] = [
  { label: 'Goa', region: 'India', kind: 'popular' },
  { label: 'Hyderabad', region: 'India', kind: 'popular' },
  { label: 'Bangalore', region: 'India', kind: 'popular' },
  { label: 'Bali', region: 'Indonesia', kind: 'popular' },
  { label: 'Dubai', region: 'UAE', kind: 'popular' },
  { label: 'Paris', region: 'France', kind: 'popular' },
];

export function filterDestinations(query: string, recent: DestinationOption[]): DestinationOption[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [
      ...recent,
      ...POPULAR_DESTINATIONS.filter((p) => !recent.some((r) => r.label.toLowerCase() === p.label.toLowerCase())),
    ];
  }
  const pool = [...recent, ...POPULAR_DESTINATIONS];
  const seen = new Set<string>();
  return pool.filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    const haystack = `${item.label} ${item.region}`.toLowerCase();
    return haystack.includes(q);
  });
}
