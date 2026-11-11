import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPublicCities } from '../publicCities';

describe('fetchPublicCities (MKT-033)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses string primitive array from GET /api/public/cities payload', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cities: ['Goa', 'Coorg', 'Manali', 'Bengaluru'] }),
    } as unknown as Response);

    const result = await fetchPublicCities();
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ label: 'Goa', region: 'India', kind: 'city' });
    expect(result[1]).toEqual({ label: 'Coorg', region: 'India', kind: 'city' });
  });

  it('parses object array with name and region fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        cities: [
          { name: 'Hyderabad', region: 'Telangana' },
          { name: 'Gurugram', region: 'Haryana' },
        ],
      }),
    } as unknown as Response);

    const result = await fetchPublicCities();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ label: 'Hyderabad', region: 'Telangana', kind: 'city' });
    expect(result[1]).toEqual({ label: 'Gurugram', region: 'Haryana', kind: 'city' });
  });

  it('returns empty array when API call fails or payload is invalid', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as unknown as Response);

    const result = await fetchPublicCities();
    expect(result).toEqual([]);
  });
});
