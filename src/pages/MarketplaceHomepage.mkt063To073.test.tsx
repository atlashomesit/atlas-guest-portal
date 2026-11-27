import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settle } from '@/test/settle';
import MarketplaceHomepage from './MarketplaceHomepage';

vi.mock('@/components/map/MultiPinMap', () => ({
  default: () => null,
}));

vi.mock('@/components/ReviewSummary', () => ({
  default: () => null,
}));

const sampleListings = [
  {
    id: 101,
    tenantSlug: 'smart-villa',
    tenantName: 'Smart Villa',
    title: 'Goa Smart Lock Villa',
    city: 'Goa',
    pricePerNight: 4500,
    maxGuests: 5,
    slug: '101',
    hasSelfCheckIn: true,
    selfCheckInMethod: 'smart_lock',
    amenityCodes: ['smart_lock', 'wifi', 'workspace_dedicated'],
    bedrooms: 2,
    beds: 3,
    bathrooms: 2,
    rating: 4.8,
    reviewCount: 24,
    isInstantBookable: true,
    eventsAllowed: true,
    smokingAllowed: false,
    hasDedicatedWorkspace: true,
    wifiSpeedMbps: 150,
    paymentTiming: 'partial_advance',
    advanceDepositPercent: 30,
  },
  {
    id: 102,
    tenantSlug: 'host-key-stay',
    tenantName: 'Key Handover Stay',
    title: 'Coorg Garden Cottage',
    city: 'Coorg',
    pricePerNight: 2800,
    maxGuests: 2,
    slug: '102',
    hasSelfCheckIn: false,
    amenityCodes: ['wifi'],
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    rating: 4.2,
    reviewCount: 10,
    isInstantBookable: false,
    eventsAllowed: false,
    smokingAllowed: true,
    hasDedicatedWorkspace: false,
    wifiSpeedMbps: 50,
    paymentTiming: 'pay_at_property',
    advanceDepositPercent: null,
  },
  {
    id: 103,
    tenantSlug: 'unrated-stay',
    tenantName: 'Unrated Homestay',
    title: 'Simple Studio',
    city: 'Kochi',
    pricePerNight: 1800,
    maxGuests: 2,
    slug: '103',
    amenityCodes: ['keypad'],
    rating: null,
    reviewCount: 0,
    isInstantBookable: true,
    eventsAllowed: null,
    smokingAllowed: null,
    paymentTiming: 'full_prepayment',
    advanceDepositPercent: 100,
  },
];

describe('MarketplaceHomepage MKT-063..MKT-073 filters', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/marketplace/listings')) {
        return {
          ok: true,
          json: async () => ({
            items: sampleListings,
            total: sampleListings.length,
            page: 1,
            pageSize: 20,
          }),
        };
      }
      if (url.includes('/marketplace/properties')) {
        return { ok: true, json: async () => [] };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('MKT-063: toggles Self check-in pill, syncs ?selfCheckIn=true, and renders Self check-in card badges', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MarketplaceHomepage />
      </MemoryRouter>,
    );
    await settle();

    // 2 of 3 listings qualify (101 has hasSelfCheckIn=true, 103 has keypad amenityCode)
    expect(screen.getAllByTestId('marketplace-self-checkin-badge')).toHaveLength(2);

    const pill = screen.getByTestId('marketplace-filter-self-checkin');
    expect(pill).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pill);
    await settle();

    expect(pill).toHaveAttribute('aria-pressed', 'true');
    const listingCalls = fetchSpy.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes('/marketplace/listings'));
    expect(listingCalls.some((u) => u.includes('selfCheckIn=true'))).toBe(true);
    expect(screen.getAllByTestId('marketplace-card')).toHaveLength(2);
  });
});
