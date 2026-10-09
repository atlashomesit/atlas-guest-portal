import { describe, expect, it } from 'vitest';
import {
  mergeListingAndExternalReviews,
  type ExternalReviewRow,
  type ListingReviewRow,
} from './reviewMerge';

describe('mergeListingAndExternalReviews (TASK-103146)', () => {
  it('suppresses external reviews with rating less than 4 stars or null rating', () => {
    const external: ExternalReviewRow[] = [
      { guestName: 'Alice', rating: 5, body: 'Super clean and spacious!', reviewDate: '2026-07-20', source: 'Airbnb' },
      { guestName: 'Bob', rating: 4, body: 'Good place, easy checkin.', reviewDate: '2026-07-21', source: 'Google' },
      { guestName: 'Charlie', rating: 3, body: 'Average stay, noisy street.', reviewDate: '2026-07-22', source: 'Airbnb' },
      { guestName: 'Dave', rating: 2, body: 'Not as described.', reviewDate: '2026-07-23', source: 'Booking.com' },
      { guestName: 'Praveen Yerra', rating: 1, body: null, reviewDate: '2026-07-20', source: 'Airbnb' },
      { guestName: 'Eve', rating: null, body: 'Unrated review text', reviewDate: '2026-07-24', source: 'Google' },
    ];

    const result = mergeListingAndExternalReviews([], external);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.guestName)).toEqual(['Bob', 'Alice']);
    expect(result.every((r) => r.rating >= 4)).toBe(true);
  });

  it('suppresses external reviews with empty or whitespace-only bodies even if rating is 5', () => {
    const external: ExternalReviewRow[] = [
      { guestName: 'Real Reviewer', rating: 5, body: 'Loved the sunrise view from the balcony!', reviewDate: '2026-08-01', source: 'Airbnb' },
      { guestName: 'Empty Body 1', rating: 5, body: null, reviewDate: '2026-08-02', source: 'Airbnb' },
      { guestName: 'Empty Body 2', rating: 5, body: '   ', reviewDate: '2026-08-03', source: 'Google' },
    ];

    const result = mergeListingAndExternalReviews([], external);

    expect(result).toHaveLength(1);
    expect(result[0].guestName).toBe('Real Reviewer');
  });

  it('suppresses native reviews with rating less than 4 stars', () => {
    const native: ListingReviewRow[] = [
      { id: 101, guestName: 'Five Star', rating: 5, body: 'Flawless hospitality!', createdAt: '2026-08-10T12:00:00Z' },
      { id: 102, guestName: 'Four Star', rating: 4, body: 'Very nice property.', createdAt: '2026-08-11T12:00:00Z' },
      { id: 103, guestName: 'Three Star', rating: 3, body: 'Could be cleaner.', createdAt: '2026-08-12T12:00:00Z' },
      { id: 104, guestName: 'One Star', rating: 1, body: 'Bad experience.', createdAt: '2026-08-13T12:00:00Z' },
    ];

    const result = mergeListingAndExternalReviews(native, []);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual([102, 101]);
  });

  it('honestly attributes review sources for Google, Airbnb, and Booking.com', () => {
    const external: ExternalReviewRow[] = [
      { rating: 5, body: 'Great Airbnb stay!', reviewDate: '2026-07-15', source: 'Airbnb' },
      { rating: 5, body: 'Great Booking stay!', reviewDate: '2026-07-16', source: 'Booking.com' },
      { rating: 5, body: 'Great Google stay!', reviewDate: '2026-07-17', source: 'Google' },
    ];

    const result = mergeListingAndExternalReviews([], external);

    const googleReview = result.find((r) => r.source === 'Google');
    const airbnbReview = result.find((r) => r.source === 'Airbnb');
    const bookingReview = result.find((r) => r.source === 'Booking.com');

    expect(googleReview?.isGoogle).toBe(true);
    expect(airbnbReview?.isGoogle).toBe(false);
    expect(bookingReview?.isGoogle).toBe(false);

    expect(airbnbReview?.guestName).toBe('Airbnb guest');
    expect(bookingReview?.guestName).toBe('Booking.com guest');
    expect(googleReview?.guestName).toBe('Google user');
  });

  it('sorts merged native and external reviews newest-first', () => {
    const native: ListingReviewRow[] = [
      { id: 1, guestName: 'Native Newer', rating: 5, body: 'Fresh direct booking review', createdAt: '2026-09-01T00:00:00Z' },
      { id: 2, guestName: 'Native Older', rating: 5, body: 'Older direct booking review', createdAt: '2026-07-01T00:00:00Z' },
    ];
    const external: ExternalReviewRow[] = [
      { guestName: 'Ext Mid', rating: 5, body: 'August Airbnb review', reviewDate: '2026-08-15', source: 'Airbnb' },
    ];

    const result = mergeListingAndExternalReviews(native, external);

    expect(result.map((r) => r.guestName)).toEqual(['Native Newer', 'Ext Mid', 'Native Older']);
  });

  it('maps host responses and responded timestamps from external reviews (REV-014)', () => {
    const external: ExternalReviewRow[] = [
      {
        guestName: 'Alice',
        rating: 5,
        body: 'Fantastic villa experience!',
        reviewDate: '2026-10-01',
        source: 'Airbnb',
        hostResponse: '  Thank you for being great guests!  ',
        respondedAt: '2026-10-02T10:00:00.000Z',
      },
      {
        guestName: 'Bob',
        rating: 4,
        body: 'Nice stay overall.',
        reviewDate: '2026-10-02',
        source: 'Google',
        hostResponse: null,
      },
    ];

    const result = mergeListingAndExternalReviews([], external);

    expect(result).toHaveLength(2);
    const alice = result.find((r) => r.guestName === 'Alice');
    const bob = result.find((r) => r.guestName === 'Bob');

    expect(alice?.hostResponse).toBe('Thank you for being great guests!');
    expect(alice?.hostResponseAt).toBe('2026-10-02T10:00:00.000Z');
    expect(bob?.hostResponse).toBeNull();
    expect(bob?.hostResponseAt).toBeNull();
  });

  it('normalizes legacy AtlasSyncBookingCom and AtlasSync sources to Booking.com (REV-011)', () => {
    const external: ExternalReviewRow[] = [
      {
        guestName: 'Kiran',
        rating: 5,
        body: 'Superb hotel apartment experience!',
        reviewDate: '2026-10-05',
        source: 'AtlasSyncBookingCom',
      },
      {
        guestName: 'Rohit',
        rating: 4,
        body: 'Great location and hospitality',
        reviewDate: '2026-10-06',
        source: 'AtlasSync',
      },
    ];

    const result = mergeListingAndExternalReviews([], external);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.source)).toEqual(['Booking.com', 'Booking.com']);
    expect(result.map((r) => r.guestName)).toEqual(['Rohit', 'Kiran']);
    expect(result.every((r) => !r.isGoogle)).toBe(true);
  });
});

