import { IS_LOCALHOST } from '@/config/env';
import { getApiBase } from '@/utils/env';

const API_BASE = getApiBase();

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const hasProtocol = /^https?:\/\//i.test(path);
  let url = path;
  if (!hasProtocol) {
    url = IS_LOCALHOST ? path : `${API_BASE}${path}`;
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
