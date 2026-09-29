/**
 * TASK-101380 — star-rating distribution for a listing's reviews summary.
 *
 * Design decision (UI/UX campaign, 2026-09-29): the distribution lives on the listing page's reviews
 * summary, which the listing card's rating chip already links to (`#reviews`). It is not repeated on
 * every grid card: five bars per card compete with photo and price, the card is already a
 * role="button" with a nested link, and the grid API carries only an average and a count.
 *
 * Truthfulness rules:
 * - Built only from this site's own reviews (`GET /api/listings/{id}/reviews` returns every review,
 *   uncapped). Google reviews are a curated subset, so they are excluded and the caption says so.
 * - Rendered only when the loaded list is complete (length equals the server's `totalCount`), every
 *   rating is a whole star from 1 to 5, and there are at least three reviews. Otherwise nothing is
 *   shown, rather than a partial or misleading picture.
 * - All five rows are shown, zeros included, so a mixed record (many 5s and 1s) is visible.
 * - Counts, not percentages: "1 of 3" reads honestly where "33%" overstates a small sample.
 */
import { starDistribution } from './starDistribution';

const reviewsLabel = (count: number) => `${count} ${count === 1 ? 'review' : 'reviews'}`;
const starsLabel = (star: number) => `${star} ${star === 1 ? 'star' : 'stars'}`;

/**
 * `otherSourcesCount`: reviews shown elsewhere on the page from other sites (e.g. Google). They are not
 * counted here, so the caption says so; otherwise the star filter's counts would silently disagree.
 */
export default function RatingDistribution({ ratings, totalCount, otherSourcesCount = 0 }: { ratings: readonly number[]; totalCount: number; otherSourcesCount?: number }) {
  const rows = starDistribution(ratings, totalCount);
  if (!rows) return null;
  const captionId = `rating-distribution-caption-${totalCount}`;
  return (
    <figure className="pp-rating-distribution" aria-labelledby={captionId} data-testid="rating-distribution" style={{ margin: 0 }}>
      <figcaption id={captionId} className="pp-rating-distribution-caption">
        <span aria-hidden="true">Star ratings</span>
        <span className="sr-only">Star ratings from {reviewsLabel(totalCount)} on this site</span>
        <span aria-hidden="true" className="pp-rating-distribution-source"> · from {reviewsLabel(totalCount)} on this site</span>
        {otherSourcesCount > 0 && (
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
              <span data-testid="rating-distribution-fill" style={{ width: `${Math.round((count / totalCount) * 100)}%` }} />
            </div>
            <span className="pp-v2-rating-bar-val" aria-hidden="true">{count}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
