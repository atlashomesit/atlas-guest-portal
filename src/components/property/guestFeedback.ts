/**
 * REV-046 (founder ruling 2026-10-28): review-QR "Guest feedback" notes.
 *
 * A guest who scans the host's review QR and gives 4-5 stars with a written note gets a card on the
 * host's own site, labelled "Guest feedback". These cards are NOT verified-stay reviews:
 *
 *  - they live in their own list (`guestFeedback` on GET /api/listings/{id}/reviews and
 *    GET /api/public/listings/{id}) and are normalised HERE, never in `reviewMerge.ts`;
 *  - nothing in this module is ever added to a count, an average, a star histogram, an "N reviews"
 *    label, a marketplace count or the schema.org JSON-LD (`aggregateRating` / `review` nodes).
 *    The score keeps coming from confirmed stays only (ruling point 6).
 *
 * Under-4-star notes never reach a website (founder ruling 2026-10-09, TASK-103146), and a rating
 * with no comment is not a card (ruling point 5). The API already enforces both; the filters below
 * keep a stale or misbehaving API from ever putting either on a guest-facing page.
 */

import { stripHtmlPreservingEmoticons } from '../../utils/sanitizeReviewText';

/** The one label every card carries, whatever the API sends in its own `label` field. */
export const GUEST_FEEDBACK_LABEL = 'Guest feedback';

/** Shown when a guest left no name. */
export const ANONYMOUS_GUEST_NAME = 'A guest';

/** A card ready to render. */
export type GuestFeedbackItem = {
  /** Stable React key within one list. */
  key: string;
  /** First name only (privacy), or {@link ANONYMOUS_GUEST_NAME}. */
  firstName: string;
  /** 4 or 5. */
  rating: number;
  /** Plain text, no HTML, never empty. */
  comment: string;
  /** Civil date `yyyy-MM-dd`; empty string when the API sent none. */
  date: string;
};

const CIVIL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function firstNameOnly(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed.split(/\s+/)[0] : ANONYMOUS_GUEST_NAME;
}

/**
 * Turns the raw `guestFeedback` arrays from the API into cards.
 *
 * Takes several sources on purpose: the listing page reads the same list from two endpoints and the
 * result must not show a note twice. Anything that is not an array, and any row that is not a 4-5 star
 * note with a comment, is skipped. Newest first.
 */
export function normalizeGuestFeedback(...sources: unknown[]): GuestFeedbackItem[] {
  const seen = new Set<string>();
  const rows: Omit<GuestFeedbackItem, 'key'>[] = [];

  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const raw of source) {
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as Record<string, unknown>;

      const rating = Number(row.rating);
      if (!Number.isFinite(rating) || rating < 4 || rating > 5) continue;

      const comment = stripHtmlPreservingEmoticons(typeof row.comment === 'string' ? row.comment : '').trim();
      if (!comment) continue;

      const dateMatch = typeof row.date === 'string' ? CIVIL_DATE_RE.exec(row.date) : null;
      const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';
      const firstName = firstNameOnly(row.guestName);
      const stars = Math.round(rating);

      const dedupeKey = [firstName, date, stars, comment].join('\u0001');
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      rows.push({ firstName, rating: stars, comment, date });
    }
  }

  // Newest first; an undated note sorts last. Array#sort is stable, so equal dates keep API order.
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows.map((row, index) => ({ ...row, key: `guest-feedback-${index}` }));
}

/**
 * "October 2026" for `yyyy-MM-dd`, matching the month-and-year dates on the other review cards.
 * The date is a civil date, so it is built and formatted in UTC: a viewer east or west of UTC must
 * not see the neighbouring month on the 1st or the last day of a month.
 */
export function formatGuestFeedbackDate(date: string): string {
  const match = CIVIL_DATE_RE.exec(date);
  if (!match) return '';
  const instant = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(instant.getTime())) return '';
  return instant.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
