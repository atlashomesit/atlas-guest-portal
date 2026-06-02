import { useEffect, useState } from "react";

import { buildApiUrl, getApiHeaders } from "@/api/client";

/**
 * TASK-2872: real verified-stay reviews for the homepage testimonials section.
 *
 * Aggregates reviews from the tenant's listings via the existing anonymous
 * GET /api/listings/{id}/reviews endpoint (already public on listing pages),
 * keeps only verified-stay reviews (rating >= 4, non-empty text), and returns
 * the most recent few. Returns an EMPTY array when there are no real reviews —
 * the section then renders nothing. This never fabricates reviewers.
 */
export type VerifiedReview = {
  id: number;
  firstName: string;
  rating: number;
  text: string;
  createdAt: string;
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

    Promise.all(
      ids.slice(0, MAX_LISTINGS_QUERIED).map((id) =>
        fetch(buildApiUrl(`/api/listings/${id}/reviews`), { headers: getApiHeaders() })
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
      ),
    ).then((results) => {
      if (!active) return;

      const collected: VerifiedReview[] = [];
      for (const res of results) {
        const list = (res?.reviews ?? []) as ReviewDto[];
        for (const r of list) {
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
