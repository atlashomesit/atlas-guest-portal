import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

describe('TestimonialsSection — review-QR guest feedback (REV-046)', () => {
  const verified = [
    { id: 2, firstName: 'Rahul', rating: 4, text: 'Clean rooms and great direct booking service.', createdAt: '2026-09-28T00:00:00.000Z' },
    { id: 3, firstName: 'Meera', rating: 5, text: 'Wonderful hosts.', createdAt: '2026-09-20T00:00:00.000Z' },
  ];
  const feedback = [
    { key: 'guest-feedback-0', firstName: 'Asha', rating: 5, comment: 'Lovely garden breakfast', date: '2026-10-28' },
    { key: 'guest-feedback-1', firstName: 'A guest', rating: 4, comment: 'Quiet and clean', date: '2026-10-20' },
  ];

  const mockHook = (value: Record<string, unknown>) => {
    vi.spyOn(useTenantListingsModule, 'useTenantListings').mockReturnValue({
      properties: [{ listingId: 101 } as any],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    vi.spyOn(useVerifiedReviewsModule, 'useVerifiedReviews').mockReturnValue(value as any);
  };

  it('puts the notes in their own labelled block under the verified reviews and keeps the rating line as it was', () => {
    mockHook({ reviews: verified, guestFeedback: feedback, loading: false });

    render(<TestimonialsSection />);

    // The headline numbers count verified reviews only.
    expect(screen.getByText(/4\.5 · 2 verified reviews/)).toBeInTheDocument();
    expect(screen.getAllByText('Verified stay')).toHaveLength(2);

    const block = screen.getByTestId('homepage-guest-feedback');
    expect(block).toHaveAccessibleName('Guest feedback');
    const cards = within(block).getAllByTestId('homepage-guest-feedback-card');
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(within(card).getByTestId('homepage-guest-feedback-label')).toHaveTextContent('Guest feedback');
      expect(card).not.toHaveTextContent(/verified/i);
    }
    expect(within(cards[0]).getByText('Asha')).toBeInTheDocument();
    expect(within(cards[0]).getByText(/Lovely garden breakfast/)).toBeInTheDocument();
    expect(within(cards[0]).getByText('October 2026')).toBeInTheDocument();
    expect(within(cards[1]).getByText('A guest')).toBeInTheDocument();

    // The block sits after the verified cards, inside the same band.
    const verifiedBand = screen.getByTestId('homepage-verified-testimonials');
    expect(verifiedBand).toContainElement(block);
    expect(screen.getAllByText(/Rahul|Meera/)).toHaveLength(2);
  });

  it('a host with only guest feedback gets a "Guest feedback" band: no rating line, no verified wording', () => {
    mockHook({ reviews: [], guestFeedback: feedback, loading: false });

    render(<TestimonialsSection />);

    const band = screen.getByTestId('homepage-guest-feedback');
    expect(screen.queryByTestId('homepage-verified-testimonials')).not.toBeInTheDocument();
    expect(within(band).getByRole('heading', { level: 2, name: 'Guest feedback' })).toBeInTheDocument();
    expect(band).toHaveTextContent('Notes shared by guests. These are not part of the star rating.');
    expect(band).not.toHaveTextContent(/verified/i);
    // No average and no review count anywhere in the band.
    expect(band.textContent ?? '').not.toMatch(/\d\.\d|\d+\s+reviews?/i);
    expect(within(band).getAllByTestId('homepage-guest-feedback-card')).toHaveLength(2);
  });

  it('shows no guest-feedback block when there is none', () => {
    mockHook({ reviews: verified, guestFeedback: [], loading: false });

    render(<TestimonialsSection />);

    expect(screen.getByTestId('homepage-verified-testimonials')).toBeInTheDocument();
    expect(screen.queryByTestId('homepage-guest-feedback')).not.toBeInTheDocument();
  });

  it('renders nothing when there are neither reviews nor guest feedback', () => {
    mockHook({ reviews: [], guestFeedback: [], loading: false });

    const { container } = render(<TestimonialsSection />);
    expect(container.firstChild).toBeNull();
  });
});
