import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { settle } from '../test/settle';
import { useVerifiedReviews } from './useVerifiedReviews';

vi.mock('../api/client', () => ({
  buildApiUrl: (path: string) => `http://localhost${path}`,
  getApiHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
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
  });
});
