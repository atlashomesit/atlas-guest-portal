import { API_BASE_URL } from '@/config/api';
import { IS_LOCALHOST } from '@/config/env';

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const hasProtocol = /^https?:\/\//i.test(path);
  let url = path;
  if (!hasProtocol) {
    if (!API_BASE_URL) {
      throw new Error(
        "API base URL is not configured. Expected Cloudflare Pages env var VITE_API_BASE_URL (available via /config). If you just added it in Cloudflare, redeploy once or confirm the correct environment (Preview vs Production)."
      );
    }
    url = IS_LOCALHOST ? path : `${API_BASE_URL}${path}`;
  }
  if (!IS_LOCALHOST && url.includes('localhost')) {
    throw new Error('Refusing localhost request from non-localhost host');
  }
  const res = await fetch(url, { credentials: 'include', ...(init || {}) });
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res;
}
