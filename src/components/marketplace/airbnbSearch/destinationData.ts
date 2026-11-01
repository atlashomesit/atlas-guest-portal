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

export function filterDestinations(
  query: string,
  recent: DestinationOption[],
  pool: DestinationOption[] = POPULAR_DESTINATIONS,
): DestinationOption[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [
      ...recent,
      ...pool.filter((p) => !recent.some((r) => r.label.toLowerCase() === p.label.toLowerCase())),
    ];
  }
  const all = [...recent, ...pool];
  const seen = new Set<string>();
  return all.filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    const haystack = `${item.label} ${item.region}`.toLowerCase();
    return haystack.includes(q);
  });
}
