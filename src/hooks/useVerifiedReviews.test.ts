import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { settle } from '../test/settle';
import { useVerifiedReviews, _clearVerifiedReviewsCacheForTests } from './useVerifiedReviews';

vi.mock('../api/client', () => ({
  buildApiUrl: (path: string) => `http://localhost${path}`,
  getApiHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  _clearVerifiedReviewsCacheForTests();
});

describe('useVerifiedReviews (REV-019)', () => {
  it('populates testimonials from external reviews when native reviews are empty', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/listings/101/reviews')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ reviews: [] }),
        });
      }
      if (url.includes('/api/public/listings/101')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 101,
            externalReviews: [
              {
                guestName: 'Sarah Jenkins',
                rating: 5,
                body: 'Wonderful stay with breathtaking views!',
                reviewDate: '2026-09-15',
                source: 'airbnb',
              },
              {
                guestName: 'Rohan Sharma',
                rating: 4.8,
                body: 'Very peaceful homestay and courteous staff.',
                reviewDate: '2026-09-20',
                source: 'booking_com',
              },
              {
                guestName: 'Low Rating Guest',
                rating: 3,
                body: 'Average experience.',
                reviewDate: '2026-09-22',
                source: 'google',
              },
              {
                guestName: 'Empty Body Guest',
                rating: 5,
                body: '   ',
                reviewDate: '2026-09-23',
                source: 'airbnb',
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => null });
    });

    vi.stubGlobal('fetch', fetcher);

    const { result } = renderHook(() => useVerifiedReviews([101], 3));
    await settle();

    expect(result.current.loading).toBe(false);
    expect(result.current.reviews).toHaveLength(2);
    // Rohan is more recent (2026-09-20) than Sarah (2026-09-15)
    expect(result.current.reviews[0]).toMatchObject({
      firstName: 'Rohan',
      rating: 4.8,
      text: 'Very peaceful homestay and courteous staff.',
      source: 'Booking.com',
    });
    expect(result.current.reviews[1]).toMatchObject({
      firstName: 'Sarah',
      rating: 5,
      text: 'Wonderful stay with breathtaking views!',
      source: 'Airbnb',
    });
  });

  it('blends native completed stays and external reviews sorted by date', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/listings/101/reviews')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            reviews: [
              {
                id: 1,
                guestName: 'Ananya Verma',
                rating: 5,
                title: 'Great direct booking experience',
                body: 'Loved the hospitality and the quiet location.',
                createdAt: '2026-10-01T12:00:00Z',
                isVerifiedStay: true,
              },
            ],
          }),
        });
      }
      if (url.includes('/api/public/listings/101')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 101,
            externalReviews: [
              {
                guestName: 'David Miller',
                rating: 4.5,
                body: 'Top notch amenities.',
                reviewDate: '2026-09-25',
                source: 'google',
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => null });
    });

    vi.stubGlobal('fetch', fetcher);

    const { result } = renderHook(() => useVerifiedReviews([101], 5));
    await settle();

    expect(result.current.loading).toBe(false);
    expect(result.current.reviews).toHaveLength(2);
    // Ananya (2026-10-01) is newer than David (2026-09-25)
    expect(result.current.reviews[0].firstName).toBe('Ananya');
    expect(result.current.reviews[0].source).toBeUndefined(); // native direct review has no external source
    expect(result.current.reviews[1].firstName).toBe('David');
    expect(result.current.reviews[1].source).toBe('Google');
  });

  it('returns empty array when neither native nor external reviews meet criteria', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reviews: [], externalReviews: [] }),
    });

    vi.stubGlobal('fetch', fetcher);

    const { result } = renderHook(() => useVerifiedReviews([101], 3));
    await settle();

    expect(result.current.loading).toBe(false);
    expect(result.current.reviews).toEqual([]);
    expect(result.current.guestFeedback).toEqual([]);
  });
});

describe('useVerifiedReviews — review-QR guest feedback (REV-046)', () => {
  const asha = { guestName: 'Asha Rao', rating: 5, comment: 'Lovely garden breakfast', date: '2026-10-28', label: 'Guest feedback' };
  const ravi = { guestName: 'Ravi', rating: 4, comment: 'Quiet and clean', date: '2026-10-20', label: 'Guest feedback' };

  const respondWith = (native: Record<string, unknown>, listing: Record<string, unknown>) =>
    vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/listings/101/reviews')) return Promise.resolve({ ok: true, json: async () => native });
      if (url.includes('/api/public/listings/101')) return Promise.resolve({ ok: true, json: async () => listing });
      return Promise.resolve({ ok: false, json: async () => null });
    });

  it('returns guest feedback as its own list and never adds it to the verified reviews', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith(
        {
          reviews: [
            { id: 1, guestName: 'Ananya Verma', rating: 5, body: 'Loved the hospitality.', createdAt: '2026-10-01T12:00:00Z', isVerifiedStay: true },
          ],
          guestFeedback: [asha, ravi],
        },
        { externalReviews: [], guestFeedback: [asha, ravi] },
      ),
    );

    const { result } = renderHook(() => useVerifiedReviews([101], 3));
    await settle();

    // The verified list and everything derived from its length (the "N verified reviews" line) is untouched.
    expect(result.current.reviews).toHaveLength(1);
    expect(result.current.reviews[0]).toMatchObject({ firstName: 'Ananya', text: 'Loved the hospitality.' });
    expect(result.current.reviews.map((r) => r.text)).not.toContain('Lovely garden breakfast');

    // The same notes arriving from both endpoints show once, newest first, first name only.
    expect(result.current.guestFeedback.map((g) => [g.firstName, g.comment])).toEqual([
      ['Asha', 'Lovely garden breakfast'],
      ['Ravi', 'Quiet and clean'],
    ]);
  });

  it('works with guest feedback alone', async () => {
    vi.stubGlobal('fetch', respondWith({ reviews: [] }, { externalReviews: [], guestFeedback: [asha] }));

    const { result } = renderHook(() => useVerifiedReviews([101], 3));
    await settle();

    expect(result.current.reviews).toEqual([]);
    expect(result.current.guestFeedback).toHaveLength(1);
  });

  it('drops under-4-star notes and notes with no comment, whatever the API sends', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith(
        {
          reviews: [],
          guestFeedback: [
            { ...asha, rating: 3, comment: 'AC was loud' },
            { ...asha, comment: '   ' },
            ravi,
          ],
        },
        {},
      ),
    );

    const { result } = renderHook(() => useVerifiedReviews([101], 3));
    await settle();

    expect(result.current.guestFeedback.map((g) => g.comment)).toEqual(['Quiet and clean']);
  });

  it('shows at most three on the homepage', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ ...asha, comment: `Note ${i}`, date: `2026-10-0${i + 1}` }));
    vi.stubGlobal('fetch', respondWith({ reviews: [], guestFeedback: many }, {}));

    const { result } = renderHook(() => useVerifiedReviews([101], 3));
    await settle();

    expect(result.current.guestFeedback).toHaveLength(3);
    expect(result.current.guestFeedback.map((g) => g.comment)).toEqual(['Note 4', 'Note 3', 'Note 2']);
  });

  it('copes with an API that does not send guest feedback yet', async () => {
    vi.stubGlobal('fetch', respondWith({ reviews: [] }, { externalReviews: [] }));

    const { result } = renderHook(() => useVerifiedReviews([101], 3));
    await settle();

    expect(result.current.loading).toBe(false);
    expect(result.current.guestFeedback).toEqual([]);
  });
});
