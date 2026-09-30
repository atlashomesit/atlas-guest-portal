import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import RatingDistribution from './RatingDistribution';
import { starDistribution } from './starDistribution';

describe('TASK-101380 star-rating distribution', () => {
  test('counts every star level, including zeros, so a mixed record is visible', () => {
    expect(starDistribution([5, 5, 1, 5, 1], 5)).toEqual([
      { star: 5, count: 3 }, { star: 4, count: 0 }, { star: 3, count: 0 }, { star: 2, count: 0 }, { star: 1, count: 2 },
    ]);
  });

  test.each([
    ['fewer than three reviews', [5, 4], 2],
    ['a list that does not match the server total (incomplete)', [5, 5, 4], 4],
    ['a fractional rating', [5, 4.5, 3], 3],
    ['an out-of-range rating', [5, 0, 3], 3],
    ['a non-numeric rating', [5, Number.NaN, 3], 3],
  ])('shows nothing for %s', (_label, ratings, total) => {
    expect(starDistribution(ratings as number[], total as number)).toBeNull();
    const { container } = render(<RatingDistribution ratings={ratings as number[]} totalCount={total as number} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders five labelled rows with real counts and states its source', () => {
    render(<RatingDistribution ratings={[5, 5, 5, 4, 1]} totalCount={5} />);
    const figure = screen.getByRole('figure', { name: 'Star ratings from 5 reviews on this site' });
    const rows = within(figure).getAllByRole('listitem');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      '5 stars: 3 reviews', '4 stars: 1 review', '3 stars: 0 reviews', '2 stars: 0 reviews', '1 star: 1 review',
    ]);
    const widths = within(figure).getAllByTestId('rating-distribution-fill').map((fill) => (fill as HTMLElement).style.width);
    expect(widths).toEqual(['60%', '20%', '0%', '0%', '20%']);
    // Counts, not percentages: small samples read honestly.
    expect(figure).not.toHaveTextContent('%');
    expect(figure).not.toHaveTextContent('other sites');
  });

  test('says when reviews from other sites are left out, so page counts never silently disagree', () => {
    render(<RatingDistribution ratings={[5, 5, 4]} totalCount={3} otherSourcesCount={1} />);
    // Screen readers hear the exclusion as part of the figure's name, not just sighted users.
    expect(screen.getByRole('figure', { name: 'Star ratings from 3 reviews on this site 1 review from other sites not included' })).toBeInTheDocument();
  });
});
