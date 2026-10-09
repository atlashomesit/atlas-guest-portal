/**
 * TASK-103146: Sub-4-star suppression on guest sites (founder ruling 2026-10-09)
 * Merges native and external reviews for public guest presentation.
 * Filters out reviews with rating < 4 or null, and suppresses empty review cards (no body and no title).
 * Corrects external review attribution (Google, Airbnb, Booking.com).
 */

export type ListingReviewRow = {
  id: number;
  guestName?: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  hostResponse?: string | null;
  hostResponseAt?: string | null;
  createdAt: string;
  isVerifiedStay?: boolean;
  ratingCleanliness?: number | null;
  ratingValue?: number | null;
  ratingCheckin?: number | null;
  ratingCommunication?: number | null;
};

export type ExternalReviewRow = {
  guestName?: string;
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
  if (lower === 'atlassyncbookingcom' || lower === 'atlassync') {
    return 'Booking.com';
  }
  return s;
}

export function mergeListingAndExternalReviews(
  native: ListingReviewRow[],
  external: ExternalReviewRow[],
): DisplayReviewRow[] {
  const validExternal = (external || []).filter((r) => {
    const rating = Number(r.rating);
    if (isNaN(rating) || rating < 4) return false;
    return Boolean(r.body && r.body.trim().length > 0);
  });

  const externalRows: DisplayReviewRow[] = validExternal.map((r, idx) => {
    const cleanSource = normalizeReviewSource(r.source);
    const isGoogle = (cleanSource ?? '').toLowerCase() === 'google' || (!cleanSource && !r.sourceUrl);
    return {
      id: -(idx + 1),
      displayKey: `ext-${idx}-${r.reviewDate ?? ''}`,
      guestName: r.guestName ?? (isGoogle ? 'Google user' : cleanSource ? `${cleanSource} guest` : 'Guest'),
      rating: Number(r.rating) || 5,
      body: r.body?.trim() ?? null,
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
    return Boolean((r.body && r.body.trim().length > 0) || (r.title && r.title.trim().length > 0));
  });

  const nativeRows: DisplayReviewRow[] = validNative.map((r) => ({
    ...r,
    displayKey: `native-${r.id}`,
  }));

  return [...nativeRows, ...externalRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
