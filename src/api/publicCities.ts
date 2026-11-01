import { buildApiUrl, getApiHeaders } from './client';
import type { DestinationOption } from '@/components/marketplace/airbnbSearch/types';

export async function fetchPublicCities(signal?: AbortSignal): Promise<DestinationOption[]> {
  const res = await fetch(buildApiUrl('/api/public/cities'), {
    headers: getApiHeaders(),
    signal,
  });
  if (!res.ok) return [];
  const body = (await res.json().catch(() => null)) as { cities?: Array<string | { name?: string; region?: string }> } | null;
  const list = body?.cities ?? [];
  return list
    .map((c): DestinationOption | null => {
      if (typeof c === 'string' && c.trim()) {
        return { label: c.trim(), region: 'India', kind: 'city' };
      }
      if (typeof c === 'object' && c !== null && typeof c.name === 'string' && c.name.trim()) {
        return { label: c.name.trim(), region: c.region ?? 'India', kind: 'city' };
      }
      return null;
    })
    .filter((c): c is DestinationOption => c !== null);
}
