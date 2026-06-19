/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

describe('secureStorage (web path)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('reads and writes via localStorage on web', async () => {
    const { storage } = await import('@/storage/secureStorage');

    await storage.set('atlas_guest_auth', '{"token":"jwt"}');
    expect(localStorage.getItem('atlas_guest_auth')).toBe('{"token":"jwt"}');
    await expect(storage.get('atlas_guest_auth')).resolves.toBe('{"token":"jwt"}');
    await storage.remove('atlas_guest_auth');
    expect(localStorage.getItem('atlas_guest_auth')).toBeNull();
  });
});
