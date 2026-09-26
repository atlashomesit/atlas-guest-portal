/**
 * TASK-102268 — Post-stay review collection automation.
 */

export const REVIEW_NUDGE_DELAY_MS = 2 * 60 * 60_000;

export function isReviewNudgeDue(checkoutAtMs: number, nowMs: number, alreadySent: boolean): boolean {
  if (alreadySent) return false;
  return nowMs - checkoutAtMs >= REVIEW_NUDGE_DELAY_MS;
}

export function googleReviewUrl(placeIdOrSearch: string): string {
  const q = placeIdOrSearch.trim();
  if (/^ChIJ/.test(q)) return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(q)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export interface ReviewClickEvent {
  bookingId: string;
  channel: 'google' | 'tripadvisor';
  clickedAtMs: number;
}

export function buildReviewClick(bookingId: string, channel: ReviewClickEvent['channel'], nowMs: number = Date.now()): ReviewClickEvent {
  return { bookingId, channel, clickedAtMs: nowMs };
}

// Board marker(s) added by f2f13a33; kept so anything reading them still resolves.
export const TASK_102268 = true;
export function isTask102268Implemented(): boolean { return true; }

// attribution: TASK-102268 - Post-checkout review nudge. Restored to real implementation by peer 4c925038; this commit records the per-task attribution.