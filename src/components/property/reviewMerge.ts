/**
 * TASK-103146 / TASK-10299093 / TASK-10299094:
 * Sub-4-star suppression and empty body review suppression on guest sites (founder ruling 2026-10-09).
 * Merges native and external reviews for public guest presentation.
 * Filters out reviews with rating < 4 or null, and suppresses reviews with empty or whitespace-only bodies.
 * Preserves '<3' heart emoticons and comparison operators while safely stripping actual HTML tags.
 * Corrects external review attribution (Google, Airbnb, Booking.com).
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
  ratingCleanliness?: number | null;
  ratingValue?: number | null;
  ratingCheckin?: number | null;
  ratingCommunication?: number | null;
  ratingAccuracy?: number | null;
  ratingLocation?: number | null;
};

export type ExternalReviewRow = {
  guestName?: string | null;
  rating?: number | null;
  body?: string | null;
  reviewDate?: string;
  source?: string;
  sourceUrl?: string | null;
  hostResponse?: string | null;
  hostResponseAt?: string | null;
  respondedAt?: string | null;
};

export type DisplayReviewRow = ListingReviewRow & {
  displayKey: string;
  isGoogle?: boolean;
  source?: string;
  sourceUrl?: string | null;
};

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
      guestName: r.guestName ?? (isGoogle ? 'Google user' : cleanSource ? `${cleanSource} guest` : 'Guest'),
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
