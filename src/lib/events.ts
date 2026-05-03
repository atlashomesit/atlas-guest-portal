/**
 * TASK-1480: Conversion funnel event tracking.
 * Posts events to /api/funnel-events (anonymous, fire-and-forget).
 */

import { buildApiUrl, getApiHeaders } from '../api/client';

const SESSION_KEY = 'atlas_session_id';

function getSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export function track(eventName: string, listingId?: number): void {
  try {
    fetch(buildApiUrl('/api/funnel-events'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
      body: JSON.stringify({
        eventName,
        sessionId: getSessionId(),
        listingId: listingId ?? null,
      }),
    }).catch(() => { /* fire and forget */ });
  } catch { /* ignore */ }
}
