import { useEffect, useState } from "react";

import { buildApiUrl, getApiHeaders } from "@/api/client";

import { normalizeReviewSource } from "@/components/property/reviewMerge";

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
 */
export type VerifiedReview = {
  id: number;
  firstName: string;
  rating: number;
  text: string;
  createdAt: string;
  source?: string;
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

const MAX_LISTINGS_QUERIED = 6;

export function useVerifiedReviews(
  listingIds: number[],
  max = 3,
): { reviews: VerifiedReview[]; loading: boolean } {
  const [reviews, setReviews] = useState<VerifiedReview[]>([]);
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
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const targetIds = ids.slice(0, MAX_LISTINGS_QUERIED);
    Promise.all(
      targetIds.map(async (id) => {
        const [nativeRes, publicRes] = await Promise.all([
          fetch(buildApiUrl(`/api/listings/${id}/reviews`), { headers: getApiHeaders() })
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null),
          fetch(buildApiUrl(`/api/public/listings/${id}`), { headers: getApiHeaders() })
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null),
        ]);
        return {
          nativeReviews: (nativeRes?.reviews ?? []) as ReviewDto[],
          externalReviews: (publicRes?.externalReviews ?? []) as ExternalReviewDto[],
        };
      }),
    ).then((results) => {
      if (!active) return;

      const collected: VerifiedReview[] = [];
      for (const res of results) {
        // Native completed stays
        for (const r of res.nativeReviews) {
          const text = (r.body ?? r.title ?? "").trim();
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
          const text = (ext.body ?? "").trim();
          if (!isNaN(rating) && rating >= 4 && text.length > 0) {
            const cleanSource = normalizeReviewSource(ext.source) ?? (ext.sourceUrl?.includes("google") ? "Google" : undefined);
            collected.push({
              id: -(collected.length + 1),
              firstName: firstNameOnly(ext.guestName),
              rating,
              text,
              createdAt: ext.reviewDate ? `${ext.reviewDate}T00:00:00.000Z` : new Date(0).toISOString(),
              source: cleanSource,
            });
          }
        }
      }

      collected.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setReviews(collected.slice(0, max));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [idsKey, max]);

  return { reviews, loading };
}
