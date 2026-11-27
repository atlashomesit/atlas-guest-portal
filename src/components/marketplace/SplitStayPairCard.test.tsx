import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { buildClientSplitStayPairs, type SplitStayCandidateListing } from '@/utils/splitStayPairing';
import SplitStayPairCard from './SplitStayPairCard';

describe('MKT-072 — buildClientSplitStayPairs & SplitStayPairCard', () => {
  const candidates: SplitStayCandidateListing[] = [
    {
      id: 1,
      tenantSlug: 'goa-villa-a',
      tenantName: 'Goa Villa A',
      title: 'Anjuna Pool Villa',
      city: 'Goa',
      imageUrl: 'https://example.com/a.jpg',
      pricePerNight: 5000,
      maxGuests: 4,
      latitude: 15.5736,
      longitude: 73.7407,
      slug: '1',
      blockedDates: ['2026-12-14'], // open Dec 10-13, blocked Dec 14
    },
    {
      id: 2,
      tenantSlug: 'goa-villa-b',
      tenantName: 'Goa Villa B',
      title: 'Vagator Garden Home',
      city: 'Goa',
      imageUrl: 'https://example.com/b.jpg',
      pricePerNight: 4500,
      maxGuests: 4,
      latitude: 15.5979,
      longitude: 73.7448,
      slug: '2',
      blockedDates: ['2026-12-11'], // blocked Dec 11, open Dec 13-16
    },
    {
      id: 3,
      tenantSlug: 'jaipur-haveli',
      tenantName: 'Jaipur Haveli',
      title: 'Jaipur Heritage Suite',
      city: 'Jaipur',
      pricePerNight: 6000,
      maxGuests: 4,
      latitude: 26.9124,
      longitude: 75.7873,
      slug: '3',
    },
  ];

  it('pairs two consecutive available homes in the same destination for a >= 4 night search', () => {
    const pairs = buildClientSplitStayPairs(candidates, '2026-12-10', '2026-12-16', 2);
    expect(pairs).toHaveLength(1);
    const pair = pairs[0];
    expect(pair.changeoverDate).toBe('2026-12-13');
    expect(pair.leg1.listingId).toBe(1);
    expect(pair.leg1.nights).toBe(3);
    expect(pair.leg2.listingId).toBe(2);
    expect(pair.leg2.nights).toBe(3);
    expect(pair.combinedTotal).toBe(5000 * 3 + 4500 * 3);
    expect(pair.distanceKm).toBeGreaterThan(0);
    expect(pair.distanceKm).toBeLessThanOrEqual(15);
  });

  it('returns empty for stays shorter than 4 nights or when guest count exceeds capacity', () => {
    expect(buildClientSplitStayPairs(candidates, '2026-12-10', '2026-12-13', 2)).toEqual([]);
    expect(buildClientSplitStayPairs(candidates, '2026-12-10', '2026-12-16', 6)).toEqual([]);
  });

  it('renders SplitStayPairCard with changeover dates, distance, combined total, and pre-filled leg links', () => {
    const [pair] = buildClientSplitStayPairs(candidates, '2026-12-10', '2026-12-16', 3);
    render(
      <MemoryRouter>
        <SplitStayPairCard pair={pair} guests={3} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('split-stay-date-summary')).toHaveTextContent('Stay 1: 10–13 Dec → Stay 2: 13–16 Dec');
    expect(screen.getByTestId('split-stay-distance')).toHaveTextContent('km apart');
    expect(screen.getByTestId('split-stay-combined-total')).toHaveTextContent('₹28,500 total');

    const leg1Link = screen.getByTestId('split-stay-leg-1-link');
    const leg2Link = screen.getByTestId('split-stay-leg-2-link');
    expect(leg1Link).toHaveAttribute('href', '/t/goa-villa-a/listings/1?checkIn=2026-12-10&checkOut=2026-12-13&guests=3');
    expect(leg2Link).toHaveAttribute('href', '/t/goa-villa-b/listings/2?checkIn=2026-12-13&checkOut=2026-12-16&guests=3');
  });
});
