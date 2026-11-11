import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { settle } from '../../../test/settle';
import { _clearVerifiedReviewsCacheForTests } from '../../../hooks/useVerifiedReviews';
import { _clearTenantListingsCacheForTests } from '../../../hooks/useTenantListings';
import { _resetTenantContextForTests, resolveFromDomain } from '../../../tenant/tenantContext';
import { invalidatePublicListingsCache } from '../../../api/listingClient';
import TestimonialsSection from '../../../components/home/TestimonialsSection';
import { useTenantListings } from '../../../hooks/useTenantListings';

describe('TASK-1039970: Guest Storefront API Call Budget & Reviews Waterfall SLA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearVerifiedReviewsCacheForTests();
    _clearTenantListingsCacheForTests();
    _resetTenantContextForTests();
    invalidatePublicListingsCache();
  });

  it('caps review queries to at most MAX_LISTINGS_QUERIED (<= 4 calls, eliminating 12-call waterfall) and initial budget <= 15 calls', async () => {
    const apiCalls: string[] = [];

    const mockFetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
      apiCalls.push(url);

      if (url.includes('/tenants/from-domain')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tenantSlug: 'star-homestays',
            brandName: 'Star Homestays',
          }),
        });
      }

      if (url.includes('/listings/public') && !url.match(/\/listings\/\d+/)) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 101, name: 'Villa 1', propertyName: 'Villa 1', maxGuests: 4, property_reviews: 12 },
            { id: 102, name: 'Villa 2', propertyName: 'Villa 2', maxGuests: 2, property_reviews: 8 },
            { id: 103, name: 'Villa 3', propertyName: 'Villa 3', maxGuests: 6, property_reviews: 5 },
            { id: 104, name: 'Villa 4', propertyName: 'Villa 4', maxGuests: 4, property_reviews: 3 },
            { id: 105, name: 'Villa 5', propertyName: 'Villa 5', maxGuests: 2, property_reviews: 2 },
            { id: 106, name: 'Villa 6', propertyName: 'Villa 6', maxGuests: 4, property_reviews: 0 },
          ],
        });
      }

      if (url.includes('/api/listings/101/reviews')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            reviews: [
              {
                id: 1,
                guestName: 'Rahul Sharma',
                rating: 5,
                title: 'Exceptional',
                body: 'Amazing stay with great views and hospitality!',
                createdAt: '2026-10-10T10:00:00Z',
                isVerifiedStay: true,
              },
              {
                id: 2,
                guestName: 'Priya Patel',
                rating: 5,
                title: 'Peaceful',
                body: 'Very serene environment and clean rooms.',
                createdAt: '2026-10-12T10:00:00Z',
                isVerifiedStay: true,
              },
              {
                id: 3,
                guestName: 'Amit Kumar',
                rating: 4.8,
                title: 'Superb',
                body: 'Had a wonderful weekend with family.',
                createdAt: '2026-10-14T10:00:00Z',
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
            externalReviews: [],
          }),
        });
      }

      if (url.includes('/api/listings/102/reviews')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ reviews: [] }),
        });
      }

      if (url.includes('/api/public/listings/102')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 102, externalReviews: [] }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    vi.stubGlobal('fetch', mockFetch);

    // 1. Resolve domain bootstrap
    await resolveFromDomain('https://api.atlaspms.in', 'star-homestays.atlastays.com');

    // 2. Component simulating storefront that mounts TestimonialsSection and multiple consumers of useTenantListings
    const StorefrontConsumer = () => {
      const { listings } = useTenantListings();
      return (
        <div>
          <span>Loaded {listings.length} listings</span>
          <TestimonialsSection listings={listings} />
        </div>
      );
    };

    render(
      <MemoryRouter>
        <StorefrontConsumer />
      </MemoryRouter>
    );

    await settle();

    // Verify reviews rendered
    expect(screen.getByTestId('homepage-verified-testimonials')).toBeInTheDocument();
    expect(screen.getByText(/What verified guests say/i)).toBeInTheDocument();
    expect(screen.getByText(/Rahul/i)).toBeInTheDocument();

    // Verify Review Waterfall SLA:
    // With 6 listings, the old code queried all 6 listings x 2 calls = 12 calls.
    // The capped code queries at most 2 listings (and exits early if 3 reviews found in listing 1 = 2 calls).
    const reviewWaterfallCalls = apiCalls.filter(
      (c) => c.includes('/api/listings/') || c.includes('/api/public/listings/')
    );
    expect(reviewWaterfallCalls.length).toBeLessThanOrEqual(4);
    expect(reviewWaterfallCalls.length).toBeGreaterThanOrEqual(1);

    // Verify total initial storefront calls budget SLA: <= 15 calls
    expect(apiCalls.length).toBeLessThanOrEqual(15);
  });
});
