import { useEffect, useState } from "react";

import { buildApiUrl, getApiHeaders } from "@/api/client";

import { normalizeReviewLocale, normalizeReviewSource, resolveReviewerName } from "@/components/property/reviewMerge";
import { normalizeGuestFeedback, type GuestFeedbackItem } from "@/components/property/guestFeedback";
import { stripHtmlPreservingEmoticons } from "@/utils/sanitizeReviewText";

/**
 * TASK-2872 / REV-019: real verified reviews for the homepage testimonials section.
 *
 * Aggregates reviews from the tenant's listings via:
 * 1. GET /api/listings/{id}/reviews (native verified stays, rating >= 4)
 * 2. GET /api/public/listings/{id} (imported OTA/Google reviews, rating >= 4)
 *
 * Keeps only verified reviews (rating >= 4, non-empty text), and returns
 * the most recent few. Returns an EMPTY array when there are no real reviews —
 * the section then renders nothing. This never fabricates reviewers.
 *
 * REV-046 (founder ruling 2026-10-28): the same two responses also carry `guestFeedback`, the 4-5 star notes
 * guests leave through the host's review QR. They come back as a SEPARATE list and are never put into
 * `reviews`, so they cannot change the "N verified reviews" line, the average or any other count.
 */
export type VerifiedReview = {
  id: number;
  firstName: string;
  rating: number;
  text: string;
  createdAt: string;
  source?: string;
  /** REV-041: validated locale of an imported review ("fr-FR"), absent for native reviews. */
  locale?: string | null;
};

type ReviewDto = {
  id: number;
  guestName?: string | null;
  rating: number;
  title?: string | null;
  body?: string | null;
  createdAt: string;
  isVerifiedStay: boolean;
};

type ExternalReviewDto = {
  guestName?: string | null;
  /** REV-041 */
  authorName?: string | null;
  /** REV-041 */
  locale?: string | null;
  rating?: number | null;
  body?: string | null;
  reviewDate?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
};

/** Privacy: show only the first name (reviews are already public per-listing). */
const firstNameOnly = (full?: string | null): string => {
  const trimmed = (full ?? "").trim();
  if (!trimmed) return "A guest";
  return trimmed.split(/\s+/)[0];
};

const MAX_LISTINGS_QUERIED = 2;

type ListingReviewBatch = {
  nativeReviews: ReviewDto[];
  externalReviews: ExternalReviewDto[];
  /** REV-046: raw `guestFeedback` rows from both endpoints; the hook normalises them once across listings. */
  guestFeedbackRaw: unknown[];
};

/** REV-046: how many guest-feedback cards the homepage shows (one row of the three-column grid). */
const MAX_GUEST_FEEDBACK = 3;

const verifiedReviewsCache = new Map<number, { promise: Promise<ListingReviewBatch>; expiresAt: number }>();

export function _clearVerifiedReviewsCacheForTests(): void {
  verifiedReviewsCache.clear();
}

function fetchListingReviewBatch(id: number): Promise<ListingReviewBatch> {
  const now = Date.now();
  const cached = verifiedReviewsCache.get(id);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = Promise.all([
    fetch(buildApiUrl(`/api/listings/${id}/reviews`), { headers: getApiHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null),
    fetch(buildApiUrl(`/api/public/listings/${id}`), { headers: getApiHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null),
  ]).then(([nativeRes, publicRes]) => ({
    nativeReviews: (nativeRes?.reviews ?? []) as ReviewDto[],
    externalReviews: (publicRes?.externalReviews ?? []) as ExternalReviewDto[],
    guestFeedbackRaw: [
      ...(Array.isArray(nativeRes?.guestFeedback) ? nativeRes.guestFeedback : []),
      ...(Array.isArray(publicRes?.guestFeedback) ? publicRes.guestFeedback : []),
    ] as unknown[],
  }));

  verifiedReviewsCache.set(id, { promise, expiresAt: now + 5 * 60 * 1000 });
  return promise;
}

export function useVerifiedReviews(
  listingIds: number[],
  max = 3,
): { reviews: VerifiedReview[]; guestFeedback: GuestFeedbackItem[]; loading: boolean } {
  const [reviews, setReviews] = useState<VerifiedReview[]>([]);
  const [guestFeedback, setGuestFeedback] = useState<GuestFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Stable dependency so the effect only re-runs when the set of ids actually changes.
  const idsKey = listingIds
    .filter((id) => typeof id === "number" && id > 0)
    .slice()
    .sort((a, b) => a - b)
    .join(",");

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",").map(Number) : [];
    if (ids.length === 0) {
      setReviews([]);
      setGuestFeedback([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const targetIds = ids.slice(0, MAX_LISTINGS_QUERIED);

    (async () => {
      const collected: VerifiedReview[] = [];
      const guestFeedbackRaw: unknown[] = [];

      for (const id of targetIds) {
        if (!active) return;
        const res = await fetchListingReviewBatch(id);
        guestFeedbackRaw.push(...res.guestFeedbackRaw);

        // Native completed stays — TASK-10299093 / TASK-10299094: suppress empty body and preserve emoticons
        for (const r of res.nativeReviews) {
          const text = stripHtmlPreservingEmoticons(r.body ?? "").trim();
          if (r.isVerifiedStay && r.rating >= 4 && text.length > 0) {
            collected.push({
              id: r.id,
              firstName: firstNameOnly(r.guestName),
              rating: r.rating,
              text,
              createdAt: r.createdAt,
            });
          }
        }

        // External verified reviews (Airbnb, Booking.com, Google)
        for (const ext of res.externalReviews) {
          const rating = Number(ext.rating);
          const text = stripHtmlPreservingEmoticons(ext.body ?? "").trim();
          if (!isNaN(rating) && rating >= 4 && text.length > 0) {
            const cleanSource = normalizeReviewSource(ext.source) ?? (ext.sourceUrl?.includes("google") ? "Google" : undefined);
            collected.push({
              id: -(collected.length + 1),
              firstName: firstNameOnly(resolveReviewerName(ext.guestName, ext.authorName)),
              rating,
              text,
              createdAt: ext.reviewDate ? `${ext.reviewDate}T00:00:00.000Z` : new Date(0).toISOString(),
              source: cleanSource,
              locale: normalizeReviewLocale(ext.locale),
            });
          }
        }

        // TASK-1039970: Stop as soon as we have enough verified reviews (SLA <= 15 calls)
        if (collected.length >= max) {
          break;
        }
      }

      if (!active) return;
      collected.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setReviews(collected.slice(0, max));
      // REV-046: one normalisation across every queried listing, so a property-level note that two listings
      // both return shows once. Deliberately kept out of `collected` above.
      setGuestFeedback(normalizeGuestFeedback(guestFeedbackRaw).slice(0, MAX_GUEST_FEEDBACK));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [idsKey, max]);

  return { reviews, guestFeedback, loading };
}
