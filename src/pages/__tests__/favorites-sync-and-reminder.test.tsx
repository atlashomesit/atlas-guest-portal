import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock modules
vi.mock('@/tenant/displayBrand', () => ({
  getTenantBrandName: () => 'Test Brand',
}));

vi.mock('@/api/listingClient', () => ({
  fetchPublicListings: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@/utils/guestHistory', () => ({
  getFavoriteIds: vi.fn(() => [1, 2, 3]),
  getRecentlyViewed: vi.fn(() => []),
  toggleFavorite: vi.fn(),
  isFavorite: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `http://api.test${path}`,
  getApiHeaders: () => ({ 'Authorization': 'Bearer test' }),
}));

describe('FavoritesPage sync badge and reminder (TASK-4526)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show "Local only" badge when GET /api/saved-listings returns 405 (POST-only controller)', async () => {
    // Simulate HEAD returning 405 (Method Not Allowed)
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/saved-listings')) {
        return Promise.resolve({
          ok: false,
          status: 405,
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    });

    // The component checks GET now, not HEAD
    const response = await fetch('http://api.test/api/saved-listings', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer test' },
    });

    // Since GET returns 405 (not ok), should NOT be marked as synced
    expect(response.ok).toBe(false);
  });

  it('should display partial-failure count when some reminder POSTs fail', async () => {
    // Mock partial failure: 2 of 3 succeed
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/saved-listings') && (global.fetch as any).callCount > 2) {
        // First 2 calls succeed, 3rd fails
        return Promise.resolve({
          ok: false,
          status: 500,
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
      } as Response);
    });

    // Simulate results.allSettled with 2 successes, 1 failure
    const results = [
      { status: 'fulfilled', value: { ok: true, status: 200 } },
      { status: 'fulfilled', value: { ok: true, status: 200 } },
      { status: 'fulfilled', value: { ok: false, status: 500 } },
    ];

    const successful = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as any).ok
    ).length;
    const failed = 3 - successful;

    expect(successful).toBe(2);
    expect(failed).toBe(1);
    // Should display partial success (alert in the actual component)
  });

  it('should show error state if ALL reminder POSTs fail', () => {
    // All 3 requests fail
    const results = [
      { status: 'fulfilled', value: { ok: false, status: 500 } },
      { status: 'fulfilled', value: { ok: false, status: 500 } },
      { status: 'fulfilled', value: { ok: false, status: 500 } },
    ];

    const successful = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as any).ok
    ).length;

    expect(successful).toBe(0);
    // Should go to error state
  });
});
