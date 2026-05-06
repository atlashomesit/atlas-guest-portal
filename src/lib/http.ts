import { getApiBaseUrl } from '@/runtime-config';
import { getApiHeaders } from '@/api/client';
import { IS_LOCALHOST } from '@/config/env';
import { messageFromApiResponse } from '@/utils/serverErrorFromResponse';
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

  let lastError: Error | undefined;
  const maxAttempts = isRetryable(init?.method) ? RETRY_LIMIT + 1 : 1;

  // Cross-origin credentialed fetches require Access-Control-Allow-Credentials on the API.
  // Guest portal public calls use JWT/headers, not cookies — omit avoids spurious CORS failures.
  const defaultCredentials: RequestCredentials = IS_LOCALHOST ? 'include' : 'omit';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await monitoredFetch(url, {
        credentials: defaultCredentials,
        ...init,
        headers: mergedHeaders,
      });
      if (!res.ok) {
        if (isRetryable(init?.method) && RETRYABLE_STATUSES.has(res.status) && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
          continue;
        }
        const msg = await messageFromApiResponse(res);
        logApiError(new Error(msg), {
          url,
          status: res.status,
          method: init?.method,
          responseSnippet: msg.slice(0, 200),
          category: 'http',
        });
        throw new Error(msg);
      }
      return res;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unexpected network error');
      if (isRetryable(init?.method) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
        continue;
      }
      logApiError(lastError, { url, method: init?.method, category: 'network' });
      throw lastError;
    }
  }
  throw lastError ?? new Error('Unexpected error in apiFetch');
}
