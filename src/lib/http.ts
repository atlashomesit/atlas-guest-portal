import { getApiBaseUrl } from '@/runtime-config';
import { IS_LOCALHOST } from '@/config/env';
import { logApiError, monitoredFetch } from './monitoring';

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
  try {
    const res = await monitoredFetch(url, { credentials: 'include', ...(init || {}) });
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch {
        // Ignore error when reading response text
      }
      logApiError(new Error(`HTTP ${res.status}`), {
        url,
        status: res.status,
        method: init?.method,
        responseSnippet: body.slice(0, 200),
        category: 'http',
      });
      throw new Error(`HTTP ${res.status}: ${body}`);
    }
    return res;
  } catch (error) {
    logApiError(error, { url, method: init?.method, category: 'network' });
    throw error instanceof Error ? error : new Error('Unexpected network error');
  }
}
