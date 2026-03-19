import { getApiBaseUrl } from '@/runtime-config';
import { getApiHeaders } from '@/api/client';
import { IS_LOCALHOST } from '@/config/env';
import { logApiError, monitoredFetch } from './monitoring';

const RETRY_LIMIT = 2;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function isRetryable(method?: string): boolean {
  return !method || method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD';
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const hasProtocol = /^https?:\/\//i.test(path);
  let url = path;
  if (!hasProtocol) {
    const apiBaseUrl = getApiBaseUrl();
    url = IS_LOCALHOST ? path : `${apiBaseUrl}${path}`;
  }
  if (!IS_LOCALHOST && url.includes('localhost')) {
    throw new Error('Refusing localhost request from non-localhost host');
  }
  const tenantHeaders = getApiHeaders();
  const mergedHeaders = { ...tenantHeaders, ...(init?.headers as Record<string, string> | undefined) };
