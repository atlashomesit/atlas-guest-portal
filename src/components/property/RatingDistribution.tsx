/**
 * TASK-101380 — star-rating distribution for a listing's reviews summary.
 * REV-030 — blended ratingStarCounts from PublicListingDto includes approved native and external (>= 4★) reviews.
 *
 * Design decision (UI/UX campaign, 2026-09-29): the distribution lives on the listing page's reviews
 * summary, which the listing card's rating chip already links to (`#reviews`). It is not repeated on
 * every grid card: five bars per card compete with photo and price, the card is already a
 * role="button" with a nested link, and the grid API carries only an average and a count.
 *
 * Truthfulness rules:
 * - When `starCounts` is provided from PublicListingDto, it carries the API's blended star rating
 *   breakdown for all approved reviews (native & external >= 4★), so no exclusion notice is shown.
 * - When built only from native reviews (`GET /api/listings/{id}/reviews`), reviews from other sites
 *   are excluded and the caption states so.
 * - Rendered only when there are at least three reviews. Otherwise nothing is shown, rather than a
 *   partial or misleading picture.
 * - All five rows are shown, zeros included, so a mixed record (many 5s and 1s) is visible.
 * - Counts, not percentages: "1 of 3" reads honestly where "33%" overstates a small sample.
 */
import { starDistribution } from './starDistribution';

const reviewsLabel = (count: number) => `${count} ${count === 1 ? 'review' : 'reviews'}`;
const starsLabel = (star: number) => `${star} ${star === 1 ? 'star' : 'stars'}`;

/**
 * `otherSourcesCount`: reviews shown elsewhere on the page from other sites (e.g. Google). They are not
 * counted when using native-only reviews, so the caption says so; otherwise the star filter's counts
 * would silently disagree.
 *
 * `starCounts`: blended star-rating counts from PublicListingDto [1★, 2★, 3★, 4★, 5★].
 */
export default function RatingDistribution({
  ratings,
  totalCount,
  otherSourcesCount = 0,
  starCounts,
}: {
  ratings?: readonly number[];
  totalCount: number;
  otherSourcesCount?: number;
  starCounts?: readonly number[] | null;
}) {
  const blendedTotal =
    starCounts && Array.isArray(starCounts) && starCounts.length === 5
      ? starCounts.reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0)
      : null;

  const rows =
    blendedTotal !== null
      ? [
          { star: 5 as const, count: starCounts![4] ?? 0 },
          { star: 4 as const, count: starCounts![3] ?? 0 },
          { star: 3 as const, count: starCounts![2] ?? 0 },
          { star: 2 as const, count: starCounts![1] ?? 0 },
          { star: 1 as const, count: starCounts![0] ?? 0 },
        ]
      : starDistribution(ratings ?? [], totalCount);

  const effectiveTotal = blendedTotal !== null ? blendedTotal : totalCount;

  if (!rows || effectiveTotal < 3) return null;

  const captionId = `rating-distribution-caption-${effectiveTotal}`;
  return (
    <figure className="pp-rating-distribution" aria-labelledby={captionId} data-testid="rating-distribution" style={{ margin: 0 }}>
      <figcaption id={captionId} className="pp-rating-distribution-caption">
        <span aria-hidden="true">Star ratings</span>
        <span className="sr-only">Star ratings from {reviewsLabel(effectiveTotal)}{blendedTotal !== null ? '' : ' on this site'}</span>
        <span aria-hidden="true" className="pp-rating-distribution-source"> · from {reviewsLabel(effectiveTotal)}{blendedTotal !== null ? '' : ' on this site'}</span>
        {otherSourcesCount > 0 && blendedTotal === null && (
          <span className="pp-rating-distribution-source" style={{ display: 'block', marginTop: 2 }}>
            {reviewsLabel(otherSourcesCount)} from other sites not included
          </span>
        )}
      </figcaption>
      <ul className="pp-v2-rating-bars" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map(({ star, count }) => (
          <li key={star} className="pp-v2-rating-bar-row" aria-label={`${starsLabel(star)}: ${reviewsLabel(count)}`}>
            <span aria-hidden="true">{star} ★</span>
            <div className="pp-v2-rating-bar" aria-hidden="true">
              <span data-testid="rating-distribution-fill" style={{ width: `${Math.round((count / effectiveTotal) * 100)}%` }} />
            </div>
            <span className="pp-v2-rating-bar-val" aria-hidden="true">{count}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
