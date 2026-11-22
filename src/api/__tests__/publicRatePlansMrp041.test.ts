import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicListingRatePlans, mapRatePlanPackageDto } from '../pricingClient';

describe('MRP-041 public rate plans — package field on fetchPublicListingRatePlans', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('copies package (camelCase) from the API row', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 12,
          listingId: 42,
          name: 'Candlelight dinner stay',
          isDefault: false,
          sortOrder: 1,
          baseNightlyRate: 3200,
          effectiveNightlyRate: 3200,
          totalStayRate: 6400,
          guests: 2,
          package: {
            title: 'Candlelight dinner stay',
            description: 'Dinner for two',
            photoUrl: 'https://cdn.example/photo.jpg',
            stayFrom: '2026-12-01',
            stayTo: '2026-12-31',
            items: [
              { label: 'Candlelit dinner', basis: 'per_stay', quantity: 2 },
              { addOnServiceId: 5, label: 'Breakfast', basis: 'per_night', quantity: 1 },
            ],
          },
        },
      ],
    });

    const plans = await fetchPublicListingRatePlans(42, '2026-11-10', '2026-11-12', 2);
    expect(plans).toHaveLength(1);
    expect(plans[0].package?.title).toBe('Candlelight dinner stay');
    expect(plans[0].package?.description).toBe('Dinner for two');
    expect(plans[0].package?.photoUrl).toBe('https://cdn.example/photo.jpg');
    expect(plans[0].package?.items).toHaveLength(2);
    expect(plans[0].package?.items[0]).toMatchObject({ label: 'Candlelit dinner', basis: 'per_stay', quantity: 2 });
    expect(plans[0].package?.items[1]).toMatchObject({ addOnServiceId: 5, label: 'Breakfast', basis: 'per_night', quantity: 1 });
  });

  it('copies Package (PascalCase) from the API row', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          Id: 12,
          ListingId: 42,
          Name: 'Package plan',
          IsDefault: false,
          SortOrder: 1,
          BaseNightlyRate: 3200,
          EffectiveNightlyRate: 3200,
          TotalStayRate: 6400,
          Guests: 2,
          Package: {
            Title: 'Weekend escape',
            Items: [{ Label: 'Bonfire', Basis: 'per_stay', Quantity: 1 }],
          },
        },
      ],
    });

    const plans = await fetchPublicListingRatePlans(42, '2026-11-10', '2026-11-12', 2);
    expect(plans[0].package?.title).toBe('Weekend escape');
    expect(plans[0].package?.items[0].label).toBe('Bonfire');
  });

  it('returns null package when the API omits it', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 11,
          listingId: 42,
          name: 'Standard Rate',
          isDefault: true,
          sortOrder: 0,
          baseNightlyRate: 2500,
          effectiveNightlyRate: 2500,
          totalStayRate: 5000,
          guests: 2,
        },
      ],
    });

    const plans = await fetchPublicListingRatePlans(42, '2026-11-10', '2026-11-12', 2);
    expect(plans[0].package ?? null).toBeNull();
  });
});

describe('mapRatePlanPackageDto', () => {
  it('returns null when title is missing or blank', () => {
    expect(mapRatePlanPackageDto(null)).toBeNull();
    expect(mapRatePlanPackageDto({ title: '  ' })).toBeNull();
  });
});