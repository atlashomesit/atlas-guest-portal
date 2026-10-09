import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TestimonialsSection from './TestimonialsSection';
import * as useVerifiedReviewsModule from '../../hooks/useVerifiedReviews';
import * as useTenantListingsModule from '../../hooks/useTenantListings';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TestimonialsSection (REV-019)', () => {
  it('renders nothing when there are no reviews (honest empty state)', () => {
    vi.spyOn(useTenantListingsModule, 'useTenantListings').mockReturnValue({
      properties: [{ listingId: 101 } as any],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    vi.spyOn(useVerifiedReviewsModule, 'useVerifiedReviews').mockReturnValue({
      reviews: [],
      loading: false,
    });

    const { container } = render(<TestimonialsSection />);
    expect(container.firstChild).toBeNull();
  });

  it('renders testimonials with external review attribution and review counts', () => {
    vi.spyOn(useTenantListingsModule, 'useTenantListings').mockReturnValue({
      properties: [{ listingId: 101 } as any],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    vi.spyOn(useVerifiedReviewsModule, 'useVerifiedReviews').mockReturnValue({
      reviews: [
        {
          id: -1,
          firstName: 'Kavita',
          rating: 5,
          text: 'Super host and wonderful experience in the hills.',
          createdAt: '2026-10-01T00:00:00.000Z',
          source: 'Airbnb',
        },
        {
          id: 2,
          firstName: 'Rahul',
          rating: 4.8,
          text: 'Clean rooms and great direct booking service.',
          createdAt: '2026-09-28T00:00:00.000Z',
        },
      ],
      loading: false,
    });

    render(<TestimonialsSection />);

    expect(screen.getByTestId('homepage-verified-testimonials')).toBeInTheDocument();
    expect(screen.getByText(/4\.9 · 2 verified reviews/)).toBeInTheDocument();

    // Attribution
    expect(screen.getByText('Kavita')).toBeInTheDocument();
    expect(screen.getByText('Airbnb review')).toBeInTheDocument();

    expect(screen.getByText('Rahul')).toBeInTheDocument();
    expect(screen.getByText('Verified stay')).toBeInTheDocument();
  });
});
