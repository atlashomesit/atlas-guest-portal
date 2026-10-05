/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addRecentlyViewed,
  getRecentlyViewed,
  loadRecentlyViewedIfAuthenticated,
  _resetRecentlyViewedSyncedForTesting,
  type GuestListingHistoryItem,
} from '../guestHistory';

// Mock storage
let mockAuthState: { isAuthenticated: boolean; token: string | null; email: string | null; guestId: number | null } | null = null;
vi.mock('@/storage/guestAuthStorage', () => ({
  getCachedGuestAuthState: () => mockAuthState,
}));

vi.mock('../api/client', () => ({
  buildApiUrl: (path: string) => `https://api.test${path}`,
  getApiHeaders: () => ({ Authorization: 'Bearer test-token' }),
}));

describe('GUEST-009: recently viewed listings cross-device sync', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetRecentlyViewedSyncedForTesting();
    vi.clearAllMocks();
    mockAuthState = null;
  });

  it('merges server and local items, keeping latest timestamps and updating localStorage', async () => {
    mockAuthState = {
      isAuthenticated: true,
      token: 'jwt-123',
      email: 'guest@example.com',
      guestId: 42,
    };

    // Pre-populate local storage with listing 10 (older) and listing 30 (local only)
    const initialLocal: GuestListingHistoryItem[] = [
      {
        listingId: 10,
        path: '/listings/10',
        name: 'Cozy Beach Cottage',
        coverPhotoUrl: 'https://img.test/10.jpg',
        location: 'Goa',
        pricePerNight: 4500,
        viewedAtUtc: '2026-10-01T10:00:00.000Z',
      },
      {
        listingId: 30,
        path: '/listings/30',
        name: 'Mountain Chalet',
        location: 'Manali',
        viewedAtUtc: '2026-10-01T08:00:00.000Z',
      },
    ];
    localStorage.setItem('atlas_recent_listings_v1', JSON.stringify(initialLocal));

    // Mock fetch for GET /api/guest/recently-viewed and subsequent POST
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/guest/recently-viewed')) {
        if (!options || options.method === 'GET' || !options.method) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                items: [
                  { listingId: 10, viewedAtUtc: '2026-10-01T12:00:00.000Z' }, // newer timestamp from other device
                  { listingId: 20, viewedAtUtc: '2026-10-01T11:00:00.000Z' }, // viewed on another device only
                ],
              }),
          });
        }
        if (options.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ items: [] }),
          });
        }
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    global.fetch = fetchMock;

    await loadRecentlyViewedIfAuthenticated();

    const merged = getRecentlyViewed();
    expect(merged.length).toBe(3);

    // Listing 10 should have updated ViewedAtUtc to 12:00 while preserving local metadata
    const item10 = merged.find((x) => x.listingId === 10);
    expect(item10).toBeDefined();
    expect(item10?.viewedAtUtc).toBe('2026-10-01T12:00:00.000Z');
    expect(item10?.name).toBe('Cozy Beach Cottage');
    expect(item10?.coverPhotoUrl).toBe('https://img.test/10.jpg');

    // Listing 20 should have been added from server
    const item20 = merged.find((x) => x.listingId === 20);
    expect(item20).toBeDefined();
    expect(item20?.viewedAtUtc).toBe('2026-10-01T11:00:00.000Z');
    expect(item20?.path).toBe('/listings/20');

    // Listing 30 should have been preserved from local
    const item30 = merged.find((x) => x.listingId === 30);
    expect(item30).toBeDefined();
    expect(item30?.viewedAtUtc).toBe('2026-10-01T08:00:00.000Z');

    // Check order: newest first (10 -> 20 -> 30)
    expect(merged[0].listingId).toBe(10);
    expect(merged[1].listingId).toBe(20);
    expect(merged[2].listingId).toBe(30);

    // localStorage should be updated
    const storedRaw = localStorage.getItem('atlas_recent_listings_v1');
    expect(storedRaw).toBeTruthy();
    const stored = JSON.parse(storedRaw!);
    expect(stored.length).toBe(3);

    // Ensure sync POST was called with merged items
    const postCall = fetchMock.mock.calls.find(
      (c: any[]) => c[0].includes('/api/guest/recently-viewed') && c[1]?.method === 'POST'
    );
    expect(postCall).toBeDefined();
  });

  it('does nothing when guest is unauthenticated', async () => {
    mockAuthState = {
      isAuthenticated: false,
      token: null,
      email: null,
      guestId: null,
    };

    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    await loadRecentlyViewedIfAuthenticated();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('addRecentlyViewed triggers server sync when guest is authenticated', async () => {
    mockAuthState = {
      isAuthenticated: true,
      token: 'jwt-123',
      email: 'guest@example.com',
      guestId: 42,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [] }),
    });
    global.fetch = fetchMock;

    addRecentlyViewed({
      listingId: 55,
      path: '/listings/55',
      name: 'Sunset Villa',
    });

    const items = getRecentlyViewed();
    expect(items.length).toBe(1);
    expect(items[0].listingId).toBe(55);

    // Sync POST should be dispatched
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/guest/recently-viewed',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
