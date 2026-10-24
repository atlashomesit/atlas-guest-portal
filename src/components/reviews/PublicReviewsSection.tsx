import React, { useMemo } from 'react';
import { sanitizeReviewText } from '@/utils/sanitizeReviewText';

export interface PublicReview {
  id: number | string;
  guestName?: string | null;
  rating?: number | null;
  title?: string | null;
  body?: string | null;
  createdAt?: string | null;
  reviewDate?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
}

export interface PublicReviewsSectionProps {
  reviews: PublicReview[];
  className?: string;
}

/**
 * TASK-10299093 / TASK-10299094:
 * Public reviews section adhering to founder invariants:
 * 1. Suppresses reviews with rating < 4 or unrated (sub-4-star suppression on guest sites).
 * 2. Suppresses reviews with empty or whitespace-only bodies (review.body.trim() === "").
 * 3. Sanitizes review text preserving '<3' emoticons, comparisons ('< 20 sqm'), and strips HTML tags safely.
 */
export const PublicReviewsSection: React.FC<PublicReviewsSectionProps> = ({
  reviews,
  className,
}) => {
  const visibleReviews = useMemo(() => {
    return (reviews || []).filter((r) => {
      const rating = Number(r.rating);
      if (isNaN(rating) || rating < 4) return false;
      const rawBody = (r.body || '').trim();
      if (!rawBody) return false;
      const cleaned = sanitizeReviewText(rawBody);
      return cleaned.length > 0;
    });
  }, [reviews]);

  if (visibleReviews.length === 0) {
    return null;
  }

  return (
    <section data-testid="public-reviews-section" className={className || "my-8 space-y-4"}>
      <h3 className="text-xl font-bold text-text-primary">
        Guest Reviews ({visibleReviews.length})
      </h3>
      <div className="grid gap-4 sm:grid-cols-2" data-testid="public-reviews-list">
        {visibleReviews.map((r) => {
          const body = sanitizeReviewText(r.body);
          const author = r.guestName?.trim() || 'Guest';
          const stars = r.rating != null ? Math.round(Number(r.rating)) : 5;
          return (
            <article
              key={r.id}
              data-testid="public-review-card"
              className="rounded-xl border border-border p-4 bg-bg-surface shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-text-primary">{author}</span>
                <span className="text-sm font-medium text-[var(--accent-text)]" aria-label={`${stars} stars`}>
                  {'★'.repeat(stars)}
                </span>
              </div>
              <p className="text-sm text-text-body leading-relaxed">{body}</p>
              {r.source && (
                <span className="mt-2 inline-block text-xs text-text-muted">
                  via {r.source}
                </span>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default PublicReviewsSection;
