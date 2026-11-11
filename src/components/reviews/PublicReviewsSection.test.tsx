import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PublicReviewsSection, { type PublicReview } from './PublicReviewsSection';

describe('TASK-10299093 & TASK-10299094 — PublicReviewsSection', () => {
  it('suppresses empty and whitespace-only body reviews and sub-4-star reviews', () => {
    const reviews: PublicReview[] = [
      {
        id: 1,
        guestName: 'Valid Guest',
        rating: 5,
        body: 'Amazing stay! Loved the views <3',
      },
      {
        id: 2,
        guestName: 'Empty Body',
        rating: 5,
        body: '',
      },
      {
        id: 3,
        guestName: 'Whitespace Body',
        rating: 5,
        body: '    \n\t  ',
      },
      {
        id: 4,
        guestName: 'Null Body',
        rating: 5,
        body: null,
      },
      {
        id: 5,
        guestName: 'Low Rating',
        rating: 3,
        body: 'Not very clean.',
      },
    ];

    render(<PublicReviewsSection reviews={reviews} />);

    // Only Valid Guest should appear
    expect(screen.getByText('Valid Guest')).toBeInTheDocument();
    expect(screen.getByText(/Amazing stay! Loved the views <3/)).toBeInTheDocument();
    expect(screen.queryByText('Empty Body')).not.toBeInTheDocument();
    expect(screen.queryByText('Whitespace Body')).not.toBeInTheDocument();
    expect(screen.queryByText('Null Body')).not.toBeInTheDocument();
    expect(screen.queryByText('Low Rating')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('public-review-card')).toHaveLength(1);
  });

  it('preserves "<3" heart emoticons and comparisons while safely stripping HTML tags', () => {
    const reviews: PublicReview[] = [
      {
        id: 10,
        guestName: 'Heart Guest',
        rating: 5,
        body: 'Loved it <3 <3 rooms < 20 sqm but cozy, price <5000 INR<b>!</b>',
      },
    ];

    render(<PublicReviewsSection reviews={reviews} />);
    expect(
      screen.getByText('Loved it <3 <3 rooms < 20 sqm but cozy, price <5000 INR!'),
    ).toBeInTheDocument();
  });
});
