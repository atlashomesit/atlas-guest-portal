import { buildApiUrl, getApiHeaders } from '@/api/client';

export type ICalSyncStatus = {
  syncStatus: 'pending' | 'syncing' | 'completed' | 'failed';
  lastSyncAt?: string;
  error?: string;
};

const ICAL_ENDPOINT = '/api/ical/sync-status';

export async function fetchICalSyncStatus(signal?: AbortSignal): Promise<ICalSyncStatus> {
  const url = buildApiUrl(ICAL_ENDPOINT);
  const response = await fetch(url, { signal, headers: getApiHeaders() });

  if (!response.ok) {
    throw new Error(`iCal sync status request failed with status ${response.status}`);
  }

  return (await response.json()) as ICalSyncStatus;
}
