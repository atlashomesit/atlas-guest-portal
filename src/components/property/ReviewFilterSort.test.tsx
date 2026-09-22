/**
 * TASK-102112 — guest review section filter (star pills) + sort ('Most Recent' /
 * 'Highest Rated').
 *
 * Prior state (the defect this fixes): the property-details review section rendered the
 * merged native + Google reviews newest-first with no way to narrow to 5-star feedback or
 * re-sort — guests could not read the most recent feedback first vs the highest rated.
 *
 * These are full-render, real-DOM tests (not source-content scans). ReviewFilterSort has
 * zero heavy dependencies (no react-icons/lucide-react/lazy chunks), so it is safe to
 * render fully — unlike the parent PropertyDetails pages, which vitest.config.ts documents
 * exhaust the Windows worker heap when rendered whole (`heavyRouteSmokes`).
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import ReviewFilterSortControls, {
  applyReviewFilterSort,
  type ReviewSortKey,
  type ReviewStarFilter,
} from './ReviewFilterSort';

type SampleReview = { id: number; guestName: string; rating: number; createdAt: string };

const SAMPLE: SampleReview[] = [
  { id: 1, guestName: 'Old Five', rating: 5, createdAt: '2025-01-10T00:00:00.000Z' },
  { id: 2, guestName: 'Mid Four', rating: 4, createdAt: '2026-03-10T00:00:00.000Z' },
  { id: 3, guestName: 'New Five', rating: 5, createdAt: '2026-08-10T00:00:00.000Z' },
  { id: 4, guestName: 'New Three', rating: 3, createdAt: '2026-09-01T00:00:00.000Z' },
];

/** Instant client-side harness: same shape as the PropertyDetails wiring (state -> helper -> cards). */
function Harness({ reviews = SAMPLE }: { reviews?: SampleReview[] }) {
  const [starFilter, setStarFilter] = useState<ReviewStarFilter>(null);
  const [sort, setSort] = useState<ReviewSortKey>('recent');
  const visible = applyReviewFilterSort(reviews, { starFilter, sort });
  const counts = {
    all: reviews.length,
    five: reviews.filter((r) => r.rating === 5).length,
    four: reviews.filter((r) => r.rating === 4).length,
  };
  return (
    <div>
      <ReviewFilterSortControls
        starFilter={starFilter}
        sort={sort}
        onStarFilterChange={setStarFilter}
        onSortChange={setSort}
        counts={counts}
      />
      {visible.length > 0 ? (
        <ul data-testid="harness-review-list">
          {visible.map((r) => (
            <li key={r.id} data-testid={`harness-review-${r.id}`}>
              {r.guestName}
            </li>
          ))}
        </ul>
      ) : (
        <p data-testid="harness-empty">
          No {starFilter}-star reviews yet.{' '}
          <button type="button" onClick={() => setStarFilter(null)}>
            Clear filter
          </button>
        </p>
      )}
    </div>
  );
}

describe('applyReviewFilterSort — TASK-102112 pure helper', () => {
  it('All + Most Recent keeps every review newest-first', () => {
    const out = applyReviewFilterSort(SAMPLE, { starFilter: null, sort: 'recent' });
    expect(out.map((r) => r.guestName)).toEqual(['New Three', 'New Five', 'Mid Four', 'Old Five']);
  });

  it('5-star pill keeps only 5-star reviews', () => {
    const out = applyReviewFilterSort(SAMPLE, { starFilter: 5, sort: 'recent' });
    expect(out.map((r) => r.guestName)).toEqual(['New Five', 'Old Five']);
  });

  it('4-star pill keeps only 4-star reviews', () => {
    const out = applyReviewFilterSort(SAMPLE, { starFilter: 4, sort: 'recent' });
    expect(out.map((r) => r.guestName)).toEqual(['Mid Four']);
  });

  it('Highest Rated orders by rating desc, breaking ties newest-first', () => {
    const out = applyReviewFilterSort(SAMPLE, { starFilter: null, sort: 'highest' });
    expect(out.map((r) => r.guestName)).toEqual(['New Five', 'Old Five', 'Mid Four', 'New Three']);
  });

  it('filter + sort compose: 5-star + Highest Rated is newest 5-star first', () => {
    const out = applyReviewFilterSort(SAMPLE, { starFilter: 5, sort: 'highest' });
    expect(out.map((r) => r.guestName)).toEqual(['New Five', 'Old Five']);
  });

  it('does not mutate the input array', () => {
    const before = SAMPLE.map((r) => r.id);
    applyReviewFilterSort(SAMPLE, { starFilter: 5, sort: 'highest' });
    expect(SAMPLE.map((r) => r.id)).toEqual(before);
  });
});

describe('ReviewFilterSortControls — TASK-102112 instant filter + sort', () => {
  it('renders All / 5-star / 4-star pills and the sort dropdown', () => {
    render(<Harness />);
    expect(screen.getByTestId('review-filter-all')).toBeInTheDocument();
    expect(screen.getByTestId('review-filter-5')).toBeInTheDocument();
    expect(screen.getByTestId('review-filter-4')).toBeInTheDocument();
    expect(screen.getByTestId('review-sort-select')).toBeInTheDocument();
    expect(screen.getByTestId('review-sort-select')).toHaveValue('recent');
  });

  it('clicking the 5-star pill narrows the cards instantly with no page reload', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('review-filter-5'));
    // Only 5-star cards remain, newest first — same-document update, no navigation.
    const list = screen.getByTestId('harness-review-list');
    expect(list.textContent).toContain('New Five');
    expect(list.textContent).toContain('Old Five');
    expect(list.textContent).not.toContain('Mid Four');
    expect(list.textContent).not.toContain('New Three');
    expect(screen.getByTestId('review-filter-5')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('review-filter-all')).toHaveAttribute('aria-pressed', 'false');
  });

  it('All pill restores the full list after filtering', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('review-filter-5'));
    expect(screen.queryByText('Mid Four')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('review-filter-all'));
    expect(screen.getByText('Mid Four')).toBeInTheDocument();
    expect(screen.getByText('New Three')).toBeInTheDocument();
  });

  it('Highest Rated re-sorts the displayed cards instantly', () => {
    render(<Harness />);
    // Default (Most Recent): New Three first.
    const items = () =>
      Array.from(
        screen.getByTestId('harness-review-list').querySelectorAll('li'),
      ).map((li) => li.textContent);
    expect(items()[0]).toBe('New Three');
    fireEvent.change(screen.getByTestId('review-sort-select'), { target: { value: 'highest' } });
    expect(items()).toEqual(['New Five', 'Old Five', 'Mid Four', 'New Three']);
  });

  it('an empty filter result explains itself and offers a one-click clear', () => {
    render(<Harness reviews={SAMPLE.filter((r) => r.rating !== 4)} />);
    fireEvent.click(screen.getByTestId('review-filter-4'));
    expect(screen.getByTestId('harness-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('harness-review-list')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /clear filter/i }));
    expect(screen.getByTestId('harness-review-list')).toBeInTheDocument();
  });
});
