/**
 * TASK-102112 — guest review star filter (All / 5★ / 4★ pills) + sort
 * ('Most Recent' / 'Highest Rated' dropdown).
 *
 * Shared by the classic property-details page
 * (`src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx`)
 * and the heritage fork (`src/themes/heritage/PropertyDetails.tsx`) so both layouts share one
 * filter/sort rule instead of duplicating it (same factoring as HostAboutNote, TASK-5181).
 *
 * Pure client-side: `applyReviewFilterSort` derives the visible cards from the already-fetched
 * merged native + Google reviews, so filtering and sorting re-render instantly with no page
 * reload and no extra API call.
 */

export type ReviewSortKey = 'recent' | 'highest';

/** Null = "All" (no star filter); otherwise the exact star rating to keep. */
export type ReviewStarFilter = number | null;

export interface FilterSortableReview {
  rating: number;
  createdAt: string;
}

export interface ReviewFilterCounts {
  all: number;
  five: number;
  four: number;
}

function timeOf(createdAt: string): number {
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

/**
 * Filter by exact star rating (when set), then sort: 'recent' = newest first,
 * 'highest' = rating desc with newest-first tie-break. Never mutates the input.
 */
export function applyReviewFilterSort<T extends FilterSortableReview>(
  reviews: readonly T[],
  opts: { starFilter: ReviewStarFilter; sort: ReviewSortKey },
): T[] {
  const filtered =
    opts.starFilter == null
      ? [...reviews]
      : reviews.filter((r) => Number(r.rating) === opts.starFilter);
  if (opts.sort === 'highest') {
    filtered.sort((a, b) => Number(b.rating) - Number(a.rating) || timeOf(b.createdAt) - timeOf(a.createdAt));
  } else {
    filtered.sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
  }
  return filtered;
}

export interface ReviewFilterSortControlsProps {
  starFilter: ReviewStarFilter;
  sort: ReviewSortKey;
  onStarFilterChange: (filter: ReviewStarFilter) => void;
  onSortChange: (sort: ReviewSortKey) => void;
  counts: ReviewFilterCounts;
}

const PILL_BASE: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border-subtle, #f0ddd0)',
  background: '#fff',
  color: 'var(--text-secondary, #6b5a55)',
  cursor: 'pointer',
  lineHeight: 1.2,
};

const PILL_ACTIVE: React.CSSProperties = {
  ...PILL_BASE,
  background: 'var(--text-primary, #4a3535)',
  borderColor: 'var(--text-primary, #4a3535)',
  color: '#fff',
};

export default function ReviewFilterSortControls({
  starFilter,
  sort,
  onStarFilterChange,
  onSortChange,
  counts,
}: ReviewFilterSortControlsProps) {
  const pill = (active: boolean) => (active ? PILL_ACTIVE : PILL_BASE);
  return (
    <div
      data-testid="reviews-filter-sort"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10,
        margin: '14px 0 4px',
      }}
    >
      <div role="group" aria-label="Filter reviews by star rating" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          data-testid="review-filter-all"
          aria-pressed={starFilter == null}
          aria-label={`Show all reviews (${counts.all})`}
          style={pill(starFilter == null)}
          onClick={() => onStarFilterChange(null)}
        >
          All ({counts.all})
        </button>
        <button
          type="button"
          data-testid="review-filter-5"
          aria-pressed={starFilter === 5}
          aria-label={`Show 5-star reviews (${counts.five})`}
          style={pill(starFilter === 5)}
          onClick={() => onStarFilterChange(5)}
        >
          5★ ({counts.five})
        </button>
        <button
          type="button"
          data-testid="review-filter-4"
          aria-pressed={starFilter === 4}
          aria-label={`Show 4-star reviews (${counts.four})`}
          style={pill(starFilter === 4)}
          onClick={() => onStarFilterChange(4)}
        >
          4★ ({counts.four})
        </button>
      </div>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-secondary, #6b5a55)',
          marginLeft: 'auto',
        }}
      >
        Sort
        <select
          data-testid="review-sort-select"
          aria-label="Sort reviews"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as ReviewSortKey)}
          style={{
            padding: '6px 10px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            border: '1px solid var(--border-subtle, #f0ddd0)',
            background: '#fff',
            color: 'var(--text-primary, #4a3535)',
            cursor: 'pointer',
          }}
        >
          <option value="recent">Most Recent</option>
          <option value="highest">Highest Rated</option>
        </select>
      </label>
    </div>
  );
}
