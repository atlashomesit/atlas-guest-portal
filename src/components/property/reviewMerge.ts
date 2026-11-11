/**
 * TASK-103146 / TASK-10299093 / TASK-10299094:
 * Sub-4-star suppression and empty body review suppression on guest sites (founder ruling 2026-10-09).
 * Merges native and external reviews for public guest presentation.
 * Filters out reviews with rating < 4 or null, and suppresses reviews with empty or whitespace-only bodies.
 * Preserves '<3' heart emoticons and comparison operators while safely stripping actual HTML tags.
 * Corrects external review attribution (Google, Airbnb, Booking.com).
 *
 * REV-046 (founder ruling 2026-10-28): review-QR "Guest feedback" notes are deliberately NOT merged here. They are
 * not verified stays, so they must never reach the combined count, the average, the star bars, the filter pills or
 * the JSON-LD that are all derived from this function's output. They have their own list and block
 * (`guestFeedback.ts`, `GuestFeedbackCards.tsx`).
 */

import { stripHtmlPreservingEmoticons } from '../../utils/sanitizeReviewText';

export type ListingReviewRow = {
  id: number;
  guestName?: string | null;
  rating: number;
  title?: string | null;
  body?: string | null;
  hostResponse?: string | null;
  hostResponseAt?: string | null;
  createdAt: string;
  photoUrls?: string[] | null;
  isVerifiedStay?: boolean;
  isHidden?: boolean;
  ratingCleanliness?: number | null;
  ratingValue?: number | null;
  ratingCheckin?: number | null;
  ratingCommunication?: number | null;
  ratingAccuracy?: number | null;
  ratingLocation?: number | null;
};

export type ExternalReviewRow = {
  guestName?: string | null;
  /** REV-041: the reviewer's real name from the OTA (Channex/Airbnb); the API already uses it when guestName is a placeholder. */
  authorName?: string | null;
  /** REV-041: the language/locale the review was written in, e.g. 'fr-FR'. */
  locale?: string | null;
  rating?: number | null;
  body?: string | null;
  reviewDate?: string;
  source?: string;
  sourceUrl?: string | null;
  hostResponse?: string | null;
  hostResponseAt?: string | null;
  respondedAt?: string | null;
  isHidden?: boolean;
};

export type DisplayReviewRow = ListingReviewRow & {
  displayKey: string;
  /** REV-041: external reviews only. */
  authorName?: string | null;
  /** REV-041: external reviews only; a validated locale code such as 'fr-FR', or null. */
  locale?: string | null;
  isGoogle?: boolean;
  source?: string;
  sourceUrl?: string | null;
};

/** Names that mean "the OTA did not give us the reviewer's name". */
const GENERIC_REVIEWER_NAMES = new Set(['guest', 'a guest', 'anonymous', 'anonymous guest', 'unknown']);

/**
 * REV-041: true for a missing/blank name or an OTA placeholder such as "Guest". The API already swaps a
 * placeholder for the real author name; this keeps the page right against an API that has not been redeployed.
 */
export function isGenericReviewerName(name?: string | null): boolean {
  const trimmed = (name ?? '').trim().toLowerCase();
  return trimmed === '' || GENERIC_REVIEWER_NAMES.has(trimmed);
}

/**
 * REV-041: the name to show on a review card. A real guest name wins; a placeholder or blank guest name falls
 * back to the author name; with no author name the stored guest name is kept (so "Guest" is never lost).
 * Returns null when there is nothing at all. The result is plain text: render it as a React child only.
 */
export function resolveReviewerName(guestName?: string | null, authorName?: string | null): string | null {
  const guest = (guestName ?? '').trim();
  const author = (authorName ?? '').trim();
  if (guest && !isGenericReviewerName(guest)) return guest;
  if (author) return author;
  return guest || null;
}

const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/;

/**
 * REV-041: validates a review locale ("fr-FR", "pt_BR") and returns it in BCP-47 form, or null when blank or
 * malformed. A value that is not a locale code is dropped rather than shown.
 */
export function normalizeReviewLocale(locale?: string | null): string | null {
  const code = (locale ?? '').trim().replace(/_/g, '-');
  if (!code || code.length > 24 || !LOCALE_PATTERN.test(code)) return null;
  return code;
}

/**
 * REV-041: a readable language label for a review locale ("fr-FR" -> "French (France)") through
 * Intl.DisplayNames, or the raw code when the runtime cannot name it. Null when there is no valid locale.
 */
export function formatReviewLocaleLabel(locale?: string | null): string | null {
  const code = normalizeReviewLocale(locale);
  if (!code) return null;
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'language', languageDisplay: 'standard' });
    const language = code.split('-')[0];
    const languageName = names.of(language);
    // An unknown language comes back as the code itself: show the code, not a half-named label.
    if (!languageName || languageName.toLowerCase() === language.toLowerCase()) return code;
    const full = names.of(code);
    // An unknown region reads "English (Unknown Region)": the language alone is the honest label then.
    if (!full || /unknown/i.test(full)) return languageName;
    return full;
  } catch {
    return code;
  }
}

/**
 * TASK-103154 (REV-011): Normalizes review source string for public display.
 * Maps legacy/plumbing values like "AtlasSyncBookingCom" or "AtlasSync" to clean brand name "Booking.com".
 */
export function normalizeReviewSource(source?: string | null): string | undefined {
  if (!source) return undefined;
  const s = source.trim();
  const lower = s.toLowerCase();
  if (lower === 'atlassyncbookingcom' || lower === 'atlassync' || lower === 'booking_com' || lower === 'booking.com') {
    return 'Booking.com';
  }
  if (lower === 'airbnb') return 'Airbnb';
  if (lower === 'google') return 'Google';
  if (lower === 'makemytrip' || lower === 'mmt') return 'MakeMyTrip';
  if (lower === 'expedia') return 'Expedia';
  if (lower === 'agoda') return 'Agoda';
  if (lower === 'vrbo') return 'Vrbo';
  return s;
}

/**
 * TASK-10298750 / TASK-10299094: Strips raw OTA scraper prefixes ("Public review:", "Headline:", "Positive:", "Negative:")
 * and HTML tags while preserving heart emoticons ('<3') and math/comparison signs ('< 20 sqm').
 */
export function stripReviewScraperBoilerplate(raw?: string | null): string {
  if (!raw) return '';
  const sanitized = stripHtmlPreservingEmoticons(raw);
  return sanitized
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*(?:public\s+review|headline)\s*:\s*/i, '')
        .replace(/^\s*(?:positive|negative)\s*:\s*/i, '')
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

export function mergeListingAndExternalReviews(
  native: ListingReviewRow[],
  external: ExternalReviewRow[],
): DisplayReviewRow[] {
  const validExternal = (external || []).filter((r) => {
    if (r.isHidden) return false;
    const rating = Number(r.rating);
    if (isNaN(rating) || rating < 4) return false;
    const rawBody = (r.body || (r as { comment?: string | null }).comment || '').trim();
    if (!rawBody) return false;
    const cleaned = stripReviewScraperBoilerplate(rawBody);
    return cleaned.trim().length > 0;
  });

  const externalRows: DisplayReviewRow[] = validExternal.map((r, idx) => {
    const cleanSource = normalizeReviewSource(r.source);
    const isGoogle = (cleanSource ?? '').toLowerCase() === 'google' || (!cleanSource && !r.sourceUrl);
    const rawBody = r.body || (r as { comment?: string | null }).comment;
    const cleanedBody = stripReviewScraperBoilerplate(rawBody).trim();
    return {
      id: -(idx + 1),
      displayKey: `ext-${idx}-${r.reviewDate ?? ''}`,
      guestName:
        resolveReviewerName(r.guestName, r.authorName) ??
        (isGoogle ? 'Google user' : cleanSource ? `${cleanSource} guest` : 'Guest'),
      authorName: r.authorName?.trim() || null,
      locale: normalizeReviewLocale(r.locale),
      rating: Number(r.rating) || 5,
      body: cleanedBody,
      createdAt: r.reviewDate ? `${r.reviewDate}T00:00:00.000Z` : new Date(0).toISOString(),
      isGoogle,
      source: cleanSource,
      sourceUrl: r.sourceUrl ?? null,
      hostResponse: r.hostResponse?.trim() ?? null,
      hostResponseAt: r.hostResponseAt ?? r.respondedAt ?? null,
    };
  });

  const validNative = (native || []).filter((r) => {
    if (r.isHidden) return false;
    const rating = Number(r.rating);
    if (isNaN(rating) || rating < 4) return false;
    const rawBody = (r.body || (r as { comment?: string | null }).comment || '').trim();
    if (!rawBody) return false;
    const body = stripHtmlPreservingEmoticons(rawBody).trim();
    return body.length > 0;
  });

  const nativeRows: DisplayReviewRow[] = validNative.map((r) => {
    const sanitizedBody = stripHtmlPreservingEmoticons(r.body || (r as { comment?: string | null }).comment).trim();
    return {
      ...r,
      body: sanitizedBody,
      displayKey: `native-${r.id}`,
    };
  });

  return [...nativeRows, ...externalRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
