import { buildApiUrl, getApiHeaders } from './client';
import type { DestinationOption } from '@/components/marketplace/airbnbSearch/types';

export async function fetchPublicCities(signal?: AbortSignal): Promise<DestinationOption[]> {
  const res = await fetch(buildApiUrl('/api/public/cities'), {
    headers: getApiHeaders(),
    signal,
  });
  if (!res.ok) return [];
  const body = (await res.json().catch(() => null)) as { cities?: Array<{ name?: string; region?: string }> } | null;
  const list = body?.cities ?? [];
  return list
    .filter((c) => typeof c?.name === 'string' && c.name.trim())
    .map((c) => ({ label: c.name!.trim(), region: c.region ?? 'India', kind: 'city' as const }));
}
